const PREFIX = "kot-pos:v1";

const scope = (branchId) => (branchId ? String(branchId) : "global");
const encode = (value) => encodeURIComponent(String(value ?? ""));

const cacheKeys = {
  menu: ({ branchId, query = {} } = {}) =>
    `${PREFIX}:menu:${scope(branchId)}:${encode(JSON.stringify(query))}`,
  availableMenu: ({ branchId } = {}) =>
    `${PREFIX}:menu-available:${scope(branchId)}`,
  settings: ({ branchId } = {}) => `${PREFIX}:settings:${scope(branchId)}`,
  aiDailySummary: ({ branchId, date } = {}) =>
    `${PREFIX}:ai:daily-summary:${scope(branchId)}:${encode(date)}`,
  aiDailySummaryText: ({ branchId, date } = {}) =>
    `${PREFIX}:ai:daily-summary-text:${scope(branchId)}:${encode(date)}`,
};

module.exports = { PREFIX, cacheKeys };
