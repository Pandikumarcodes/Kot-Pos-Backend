const { GoogleGenAI } = require("@google/genai");
const inventoryRepository = require("../repositories/InventoryRepository");
const stockLogRepository = require("../repositories/StockLogRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const billingRepository = require("../repositories/BillingRepository");
const AppError = require("../utils/AppError");
const { cache, cacheKeys } = require("../infrastructure/cache");

const client = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;
const MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-flash-preview",
  "gemini-3-flash-preview",
];

const utcMidnight = (offsetDays = 0) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date;
};

const callGemini = async (prompt) => {
  if (!client)
    throw new AppError("AI client not initialized — check GEMINI_API_KEY", 503);
  let lastError;
  for (const modelName of MODELS) {
    try {
      const result = await client.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction:
            "You are the KOT POS AI analyst for a restaurant. Keep responses short, clear and professional. Max 3 sentences. No markdown formatting.",
        },
      });
      if (result?.text) return result.text;
      throw new Error("Empty response from AI");
    } catch (err) {
      lastError = err;
      if (err.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      break;
    }
  }
  throw lastError;
};

const getAiSummary = async (prompt, cacheKey) => {
  return cache.getOrSet(cacheKey, () => callGemini(prompt), { ttlSeconds: 600 });
};

const chat = async ({ message, context }) => {
  if (!client)
    throw new AppError(
      "AI service not configured. Add GEMINI_API_KEY to environment.",
      503,
    );
  const safeContext = context
    ? {
        totalRevenue: context.totalRevenue,
        totalOrders: context.totalOrders,
        avgOrderValue: context.avgOrderValue,
        orderTrend: context.orderTrend,
        orderChange: context.orderChange,
        peakHour: context.peakHour,
        topItems: Array.isArray(context.topItems)
          ? context.topItems.slice(0, 5)
          : [],
        dineIn: context.dineIn,
        takeaway: context.takeaway,
        paymentBreakdown: context.paymentBreakdown,
        criticalStockItems: context.criticalStockItems,
        date: context.date,
      }
    : {};
  const prompt = `
      Restaurant data context:
      ${JSON.stringify(safeContext, null, 2)}

      User question: ${message}

      Instructions:
      - Give a short, clear answer (max 3 sentences)
      - Use specific numbers from the data when available
      - If data is not available, say so clearly
      - Compare trends when asked (up/down vs previous period)
      - Plain text only, no markdown
      - Be friendly and professional
    `;
  try {
    return await callGemini(prompt);
  } catch (err) {
    return err?.status === 429
      ? "The AI quota is temporarily exhausted. Please wait 60 seconds and try again."
      : "I'm having trouble connecting right now. Please try again in a moment.";
  }
};

const getInventoryAlerts = async (branchFilter) => {
  const items = await inventoryRepository.listLean(branchFilter);
  if (!items.length) {
    return {
      alerts: [],
      counts: { critical: 0, warning: 0, info: 0, ok: 0 },
      message: "No inventory items found.",
    };
  }
  const logs = await stockLogRepository.listLean({
    ...branchFilter,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    type: "deduction",
  });
  const usageMap = {};
  logs.forEach((log) => {
    const key = (log.item ?? log.itemId)?.toString();
    if (!key) return;
    if (!usageMap[key]) usageMap[key] = { total: 0, days: new Set() };
    usageMap[key].total += log.quantity ?? 0;
    usageMap[key].days.add(new Date(log.createdAt).toDateString());
  });
  const alerts = items.map((item) => {
    const usage = usageMap[item._id?.toString()];
    const currentStock = item.currentStock ?? 0;
    const reorderLevel = item.reorderLevel ?? 0;
    const unit = item.unit ?? "";
    const avgDailyUsage = (usage?.total || 0) / (usage?.days.size || 1);
    const daysUntilStockout =
      avgDailyUsage > 0 ? Math.floor(currentStock / avgDailyUsage) : null;
    let level = "ok";
    let emoji = "✅";
    let message;
    if (currentStock <= 0) {
      level = "critical";
      emoji = "🔴";
      message = "Out of stock! Reorder immediately.";
    } else if (currentStock <= reorderLevel) {
      level = "critical";
      emoji = "🔴";
      message = `Below reorder level (${reorderLevel}${unit}). Order now.`;
    } else if (daysUntilStockout !== null && daysUntilStockout <= 2) {
      level = "critical";
      emoji = "🔴";
      message = `Will run out in ~${daysUntilStockout} day${daysUntilStockout === 1 ? "" : "s"}. Reorder urgently.`;
    } else if (daysUntilStockout !== null && daysUntilStockout <= 5) {
      level = "warning";
      emoji = "🟡";
      message = `Will run out in ~${daysUntilStockout} days. Consider reordering.`;
    } else if (daysUntilStockout !== null && daysUntilStockout <= 10) {
      level = "info";
      emoji = "🔵";
      message = `Stock sufficient for ~${daysUntilStockout} days.`;
    } else {
      message =
        daysUntilStockout !== null
          ? `Stock sufficient for ${daysUntilStockout}+ days.`
          : "No recent usage data available.";
    }
    return {
      _id: item._id,
      name: item.name,
      currentStock,
      unit,
      reorderLevel,
      avgDailyUsage: parseFloat(avgDailyUsage.toFixed(2)),
      daysUntilStockout,
      level,
      emoji,
      message,
    };
  });
  const sortOrder = { critical: 0, warning: 1, info: 2, ok: 3 };
  alerts.sort((a, b) => sortOrder[a.level] - sortOrder[b.level]);
  return {
    alerts,
    counts: {
      critical: alerts.filter((alert) => alert.level === "critical").length,
      warning: alerts.filter((alert) => alert.level === "warning").length,
      info: alerts.filter((alert) => alert.level === "info").length,
      ok: alerts.filter((alert) => alert.level === "ok").length,
    },
  };
};

const generateFallbackSummary = (data) => {
  const trend =
    data.orderTrend === "up"
      ? "📈 up from previous day"
      : data.orderTrend === "down"
        ? "📉 down from previous day"
        : "stable";
  const stockMessage =
    data.criticalStockItems.length > 0
      ? ` ⚠️ Reorder needed for: ${data.criticalStockItems.join(", ")}.`
      : " Stock levels are healthy.";
  return `Good morning! Here's your summary for ${data.date}. Total revenue was ${data.totalRevenue} from ${data.totalOrders} orders (${trend}). Best selling item: ${data.topItems[0]?.name ?? "N/A"}. Peak hour: ${data.peakHour}. Average order value: ${data.avgOrderValue}. Dine-in: ${data.dineIn}, Takeaway: ${data.takeaway}.${stockMessage}`;
};

const buildDailySummary = async ({
  branchFilter,
  branchMemberFilter,
  branchId,
}) => {
  const today = utcMidnight(0);
  const yesterday = utcMidnight(1);
  const dayBefore = utcMidnight(2);
  const [yesterdayOrders, dayBeforeOrders, yesterdayBills] = await Promise.all([
    kitchenRepository.listLean({
      ...branchFilter,
      createdAt: { $gte: yesterday, $lt: today },
      status: { $ne: "cancelled" },
    }),
    kitchenRepository.listLean({
      ...branchFilter,
      createdAt: { $gte: dayBefore, $lt: yesterday },
      status: { $ne: "cancelled" },
    }),
    billingRepository.listLean({
      ...branchMemberFilter,
      createdAt: { $gte: yesterday, $lt: today },
      paymentStatus: "paid",
    }),
  ]);
  const totalRevenue = yesterdayBills.reduce(
    (sum, bill) => sum + (bill.totalAmount ?? 0),
    0,
  );
  const totalOrders = yesterdayOrders.length;
  const previousOrders = dayBeforeOrders.length;
  const orderChange =
    previousOrders > 0
      ? (((totalOrders - previousOrders) / previousOrders) * 100).toFixed(1)
      : null;
  const itemCount = {};
  const hourCount = {};
  yesterdayOrders.forEach((order) => {
    order.items?.forEach((item) => {
      const name = item.name ?? "Unknown";
      itemCount[name] = (itemCount[name] ?? 0) + (item.quantity ?? 1);
    });
    const hour = new Date(order.createdAt).getHours();
    hourCount[hour] = (hourCount[hour] ?? 0) + 1;
  });
  const topItems = Object.entries(itemCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));
  const peakEntry = Object.entries(hourCount).sort(([, a], [, b]) => b - a)[0];
  const paymentBreakdown = {};
  yesterdayBills.forEach((bill) => {
    const method = bill.paymentMethod ?? "unknown";
    paymentBreakdown[method] = (paymentBreakdown[method] ?? 0) + 1;
  });
  const inventoryItems = await inventoryRepository.listLean(branchFilter);
  const summaryData = {
    date: yesterday.toDateString(),
    totalRevenue: `₹${totalRevenue.toLocaleString()}`,
    totalOrders,
    orderChange: orderChange ? `${orderChange}%` : "no previous data",
    orderTrend: orderChange
      ? parseFloat(orderChange) >= 0
        ? "up"
        : "down"
      : "neutral",
    topItems,
    peakHour: peakEntry
      ? `${peakEntry[0]}:00 - ${parseInt(peakEntry[0]) + 1}:00`
      : "N/A",
    paymentBreakdown,
    dineIn: yesterdayOrders.filter((order) => order.orderType === "dine-in")
      .length,
    takeaway: yesterdayOrders.filter((order) => order.orderType === "takeaway")
      .length,
    avgOrderValue:
      totalOrders > 0 ? `₹${(totalRevenue / totalOrders).toFixed(0)}` : "₹0",
    criticalStockItems: inventoryItems
      .filter((item) => (item.currentStock ?? 0) <= (item.reorderLevel ?? 0))
      .map((item) => item.name),
  };
  let aiSummary = generateFallbackSummary(summaryData);
  if (client) {
    try {
      const prompt = `You are a smart restaurant business analyst for KOT POS. Generate a concise morning summary report for the restaurant owner/manager. Yesterday's data: ${JSON.stringify(summaryData, null, 2)} Write a friendly, professional summary with overall performance, revenue and order highlights, the top selling item, one actionable insight, and critical stock alerts. Keep it under 150 words in one plain-text paragraph. Start with "Good morning! Here's your summary for ${summaryData.date}."`;
      aiSummary = await getAiSummary(prompt, cacheKeys.aiDailySummaryText({ branchId, date: summaryData.date }));
    } catch (err) {
      aiSummary = generateFallbackSummary(summaryData);
    }
  }
  return { data: summaryData, aiSummary };
};

const getDailySummary = async (options) => cache.getOrSet(
  cacheKeys.aiDailySummary({ branchId: options?.branchId, date: utcMidnight(1).toDateString() }),
  () => buildDailySummary(options),
  { ttlSeconds: 600 },
);

module.exports = {
  chat,
  getInventoryAlerts,
  getDailySummary,
  generateFallbackSummary,
};
