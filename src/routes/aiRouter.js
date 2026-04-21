const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { userAuth, allowRoles } = require("../middlewares/auth");

const Inventory = require("../models/Inventory");
const StockLog = require("../models/StockLog");
const Kot = require("../models/kot");
const Billing = require("../models/billings");

const router = express.Router();

// ── UTC midnight helper ───────────────────────────────────────
function utcMidnight(offsetDays = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d;
}

// ── Gemini setup (new @google/genai SDK) ──────────────────────
const client = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-flash-preview",
  "gemini-3-flash-preview",
];

// ── Core Gemini caller ────────────────────────────────────────
async function callGemini(prompt) {
  if (!client)
    throw new Error("AI client not initialized — check GEMINI_API_KEY");

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
      const responseText = result.text;

      if (result && responseText) {
        console.log(
          `✅ AI request success — model: ${modelName}, time: ${new Date().toISOString()}`,
        );
        return responseText;
      }
      throw new Error("Empty response from AI");
    } catch (err) {
      console.error(`Gemini model ${modelName} failed:`, {
        message: err.message,
        status: err.status,
        code: err.code,
        details: err.errorDetails ?? err.response?.data ?? "no details",
      });
      lastError = err;
      if (err.status === 429) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      break;
    }
  }
  throw lastError;
}

// ── Daily summary cache ───────────────────────────────────────
// Gemini called ONCE per 10 minutes for summary — cached after that
const summaryCache = { text: null, expiry: 0 };
const CACHE_TTL = 10 * 60 * 1000;

async function getAiSummary(prompt) {
  if (summaryCache.text && summaryCache.expiry > Date.now()) {
    console.log("Returning cached AI summary");
    return summaryCache.text;
  }
  const text = await callGemini(prompt);
  summaryCache.text = text;
  summaryCache.expiry = Date.now() + CACHE_TTL;
  return text;
}

// ── Common middleware ─────────────────────────────────────────
router.use(userAuth, allowRoles(["admin", "manager"]));

// ════════════════════════════════════════════════════════════
// 1. AI SALES ASSISTANT  —  POST /api/v1/ai/chat
// ════════════════════════════════════════════════════════════
router.post("/chat", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        error: "AI service not configured. Add GEMINI_API_KEY to environment.",
      });
    }

    const { message, context } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

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

    const reply = await callGemini(prompt);
    res.json({ reply });
  } catch (err) {
    console.error("AI chat error FULL:", {
      message: err.message,
      status: err.status,
      code: err.code,
      stack: err.stack,
    });
    const feedback =
      err?.status === 429
        ? "The AI quota is temporarily exhausted. Please wait 60 seconds and try again."
        : "I'm having trouble connecting right now. Please try again in a moment.";
    res.json({ reply: feedback });
  }
});

// ════════════════════════════════════════════════════════════
// 2. INVENTORY ALERTS  —  GET /api/v1/ai/inventory-alerts
// ════════════════════════════════════════════════════════════
router.get("/inventory-alerts", async (req, res) => {
  try {
    const branchFilter = req.user?.branchId
      ? { branchId: req.user.branchId }
      : {};

    const items = await Inventory.find(branchFilter).lean();
    if (!items.length) {
      return res.json({
        alerts: [],
        counts: { critical: 0, warning: 0, info: 0, ok: 0 },
        message: "No inventory items found.",
      });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const logs = await StockLog.find({
      ...branchFilter,
      createdAt: { $gte: thirtyDaysAgo },
      type: "deduction",
    }).lean();

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

      let level = "ok",
        message = "",
        emoji = "✅";
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
        level = "ok";
        emoji = "✅";
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

    const counts = {
      critical: alerts.filter((a) => a.level === "critical").length,
      warning: alerts.filter((a) => a.level === "warning").length,
      info: alerts.filter((a) => a.level === "info").length,
      ok: alerts.filter((a) => a.level === "ok").length,
    };

    res.json({ alerts, counts });
  } catch (err) {
    console.error("Inventory alerts error:", err);
    res.status(500).json({ error: "Failed to generate inventory alerts" });
  }
});

// ════════════════════════════════════════════════════════════
// 3. SMART DAILY SUMMARY  —  GET /api/v1/ai/daily-summary
// ════════════════════════════════════════════════════════════
router.get("/daily-summary", async (req, res) => {
  try {
    const branchFilter = req.user?.branchId
      ? { branchId: req.user.branchId }
      : {};

    const today = utcMidnight(0);
    const yesterday = utcMidnight(1);
    const dayBefore = utcMidnight(2);

    const [yesterdayOrders, dayBeforeOrders, yesterdayBills] =
      await Promise.all([
        Kot.find({
          ...branchFilter,
          createdAt: { $gte: yesterday, $lt: today },
          status: { $ne: "cancelled" },
        }).lean(),
        Kot.find({
          ...branchFilter,
          createdAt: { $gte: dayBefore, $lt: yesterday },
          status: { $ne: "cancelled" },
        }).lean(),
        Billing.find({
          ...branchFilter,
          createdAt: { $gte: yesterday, $lt: today },
          paymentStatus: "paid",
        }).lean(),
      ]);

    const totalRevenue = yesterdayBills.reduce(
      (sum, b) => sum + (b.totalAmount ?? 0),
      0,
    );
    const totalOrders = yesterdayOrders.length;
    const prevOrders = dayBeforeOrders.length;
    const orderChange =
      prevOrders > 0
        ? (((totalOrders - prevOrders) / prevOrders) * 100).toFixed(1)
        : null;

    const itemCount = {};
    yesterdayOrders.forEach((order) => {
      order.items?.forEach((item) => {
        const name = item.name ?? "Unknown";
        itemCount[name] = (itemCount[name] ?? 0) + (item.quantity ?? 1);
      });
    });
    const topItems = Object.entries(itemCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    const hourCount = {};
    yesterdayOrders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();
      hourCount[hour] = (hourCount[hour] ?? 0) + 1;
    });
    const peakEntry = Object.entries(hourCount).sort(
      ([, a], [, b]) => b - a,
    )[0];
    const peakHour = peakEntry
      ? `${peakEntry[0]}:00 - ${parseInt(peakEntry[0]) + 1}:00`
      : "N/A";

    const paymentBreakdown = {};
    yesterdayBills.forEach((bill) => {
      const method = bill.paymentMethod ?? "unknown";
      paymentBreakdown[method] = (paymentBreakdown[method] ?? 0) + 1;
    });

    const dineIn = yesterdayOrders.filter(
      (o) => o.orderType === "dine-in",
    ).length;
    const takeaway = yesterdayOrders.filter(
      (o) => o.orderType === "takeaway",
    ).length;

    const inventoryItems = await Inventory.find(branchFilter).lean();
    const criticalStock = inventoryItems
      .filter((item) => (item.currentStock ?? 0) <= (item.reorderLevel ?? 0))
      .map((item) => item.name);

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
      peakHour,
      paymentBreakdown,
      dineIn,
      takeaway,
      avgOrderValue:
        totalOrders > 0 ? `₹${(totalRevenue / totalOrders).toFixed(0)}` : "₹0",
      criticalStockItems: criticalStock,
    };

    let aiSummary;
    if (client) {
      try {
        const prompt = `
          You are a smart restaurant business analyst for KOT POS.
          Generate a concise morning summary report for the restaurant owner/manager.

          Yesterday's data:
          ${JSON.stringify(summaryData, null, 2)}

          Write a friendly, professional summary with:
          1. Overall performance (good/average/needs attention)
          2. Revenue and order highlights
          3. Top selling item mention
          4. One actionable business insight or recommendation
          5. Stock alert if any critical items need reordering

          Keep it under 150 words. Use simple English.
          No bullet points — write in paragraph form.
          Start with "Good morning! Here's your summary for ${summaryData.date}."
        `;
        aiSummary = await getAiSummary(prompt);
      } catch (geminiErr) {
        console.error("Gemini daily summary error:", geminiErr.message);
        aiSummary = generateFallbackSummary(summaryData);
      }
    } else {
      aiSummary = generateFallbackSummary(summaryData);
    }

    res.json({ data: summaryData, aiSummary });
  } catch (err) {
    console.error("Daily summary error:", err);
    res.status(500).json({ error: "Failed to generate daily summary" });
  }
});

function generateFallbackSummary(data) {
  const trend =
    data.orderTrend === "up"
      ? "📈 up from previous day"
      : data.orderTrend === "down"
        ? "📉 down from previous day"
        : "stable";
  const topItem = data.topItems[0]?.name ?? "N/A";
  const stockMsg =
    data.criticalStockItems.length > 0
      ? ` ⚠️ Reorder needed for: ${data.criticalStockItems.join(", ")}.`
      : " Stock levels are healthy.";
  return (
    `Good morning! Here's your summary for ${data.date}. ` +
    `Total revenue was ${data.totalRevenue} from ${data.totalOrders} orders (${trend}). ` +
    `Best selling item: ${topItem}. Peak hour: ${data.peakHour}. ` +
    `Average order value: ${data.avgOrderValue}. ` +
    `Dine-in: ${data.dineIn}, Takeaway: ${data.takeaway}.` +
    stockMsg
  );
}

module.exports = router;
