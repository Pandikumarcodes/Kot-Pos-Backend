const reportRepository = require("../repositories/ReportRepository");

const getDateRange = (range, from, to) => {
  const now = new Date();
  let start;
  let end;
  switch (range) {
    case "week":
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    case "month":
      start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      break;
    case "custom":
      start = from ? new Date(from) : new Date(now.setHours(0, 0, 0, 0));
      end = to ? new Date(to) : new Date();
      end.setHours(23, 59, 59, 999);
      break;
    case "today":
    default:
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
  }
  return { start, end };
};

const getSummary = async ({
  range = "today",
  from,
  to,
  branchMemberFilter,
  branchFilter,
}) => {
  const { start, end } = getDateRange(range, from, to);
  const [revenueResult, dineInCount, takeawayCount] = await Promise.all([
    reportRepository.getRevenueSummary({
      ...branchMemberFilter,
      paymentStatus: "paid",
      createdAt: { $gte: start, $lte: end },
    }),
    reportRepository.countDineInOrders({
      ...branchMemberFilter,
      createdAt: { $gte: start, $lte: end },
    }),
    reportRepository.countKitchenOrders({
      ...branchFilter,
      orderType: "takeaway",
      createdAt: { $gte: start, $lte: end },
    }),
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;
  const totalBills = revenueResult[0]?.count || 0;
  return {
    totalRevenue,
    totalOrders: dineInCount + takeawayCount,
    totalBills,
    avgOrderValue: totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0,
    dineInCount,
    takeawayCount,
  };
};

const getTopItems = ({ range = "today", from, to, branchFilter }) => {
  const { start, end } = getDateRange(range, from, to);
  return reportRepository.getTopItems({
    ...branchFilter,
    createdAt: { $gte: start, $lte: end },
  });
};

const getPayments = async ({
  range = "today",
  from,
  to,
  branchMemberFilter,
}) => {
  const { start, end } = getDateRange(range, from, to);
  const payments = await reportRepository.getPayments({
    ...branchMemberFilter,
    paymentStatus: "paid",
    createdAt: { $gte: start, $lte: end },
  });
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return payments.map((payment) => ({
    ...payment,
    percentage: total > 0 ? Math.round((payment.amount / total) * 100) : 0,
  }));
};

const getHourlySales = async ({
  range = "today",
  from,
  to,
  branchMemberFilter,
}) => {
  const { start, end } = getDateRange(range, from, to);
  const hourly = await reportRepository.getHourlySales({
    ...branchMemberFilter,
    paymentStatus: "paid",
    createdAt: { $gte: start, $lte: end },
  });
  return hourly.map((entry) => ({
    hour:
      entry.hour < 12
        ? `${entry.hour} AM`
        : entry.hour === 12
          ? "12 PM"
          : `${entry.hour - 12} PM`,
    orders: entry.orders,
    revenue: entry.revenue,
  }));
};

const getCashierIncome = async (userId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const income = await reportRepository.getCashierIncome({
    createdAt: { $gte: todayStart },
    createdBy: userId,
    paymentStatus: "paid",
  });
  return income[0]?.totalIncome || 0;
};

module.exports = {
  getDateRange,
  getSummary,
  getTopItems,
  getPayments,
  getHourlySales,
  getCashierIncome,
};
