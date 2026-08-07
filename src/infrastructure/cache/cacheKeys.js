const PREFIX = "kot-pos:v1";

const scopeKey = (value) => {
  if (value && value.type === "branch" && value.branchId) return String(value.branchId);
  if (value && value.type === "global" && value.branchId === null) return "global";
  if (value) return String(value);
  return "invalid-scope";
};
const encode = (value) => encodeURIComponent(String(value ?? ""));

const cacheKeys = {
  menu: ({ scope, branchId, query = {} } = {}) =>
    `${PREFIX}:menu:${scopeKey(scope || branchId)}:${encode(JSON.stringify(query))}`,
  availableMenu: ({ branchId } = {}) =>
    `${PREFIX}:menu-available:${scopeKey(branchId)}`,
  settings: ({ branchId } = {}) => `${PREFIX}:settings:${scopeKey(branchId === undefined ? "global" : branchId)}`,
  aiDailySummary: ({ scope, branchId, date } = {}) =>
    `${PREFIX}:ai:daily-summary:${scopeKey(scope || branchId)}:${encode(date)}`,
  aiDailySummaryText: ({ scope, branchId, date } = {}) =>
    `${PREFIX}:ai:daily-summary-text:${scopeKey(scope || branchId)}:${encode(date)}`,
};

module.exports = { PREFIX, cacheKeys };
