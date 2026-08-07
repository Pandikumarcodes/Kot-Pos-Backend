const createBaseRepository = require("./BaseRepository");
const Billing = require("../models/billings");
const { leanQuery } = require("./readQuery");
const { normalizeObjectId } = require("../utils/branchId");
const { directBranchFilter } = require("../utils/operationalOwnership");

const baseRepository = createBaseRepository(Billing);

const assertBillingScope = (scope, filter = {}) => {
  if (!scope || scope.type !== "branch" || !scope.branchId) {
    throw new Error("Billing repository requires a branch scope");
  }
  return filter;
};

const countCreatedSince = (date, options = {}) =>
  baseRepository.count({ createdAt: { $gte: date } }, options);

const findMaxSequenceForDate = async (dateStart, dateEnd, date, options = {}) => {
  const bills = await baseRepository
    .findMany(
      {
        createdAt: { $gte: dateStart, $lt: dateEnd },
        billNumber: new RegExp(`^BILL-${date}-(\\d+)$`),
      },
      { billNumber: 1 },
      options,
    )
    .lean();

  return bills.reduce((max, bill) => {
    const match = bill.billNumber.match(new RegExp(`^BILL-${date}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
};

const createBillDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const createBill = (data, options = {}) => baseRepository.create(data, options);

const normalizeBillingFilter = (filter = {}) => {
  const normalized = { ...filter };
  if (normalized.createdBy && "$in" in normalized.createdBy) {
    normalized.createdBy = {
      ...normalized.createdBy,
      $in: (Array.isArray(normalized.createdBy.$in)
        ? normalized.createdBy.$in
        : []
      ).map(normalizeObjectId).filter(Boolean),
    };
  }
  return normalized;
};

const listScoped = (filter, options = {}, scope) => {
  assertBillingScope(scope, filter);
  filter = directBranchFilter(scope, filter);
  filter = normalizeBillingFilter(filter);
  if (!Object.keys(options).length) {
    const query = baseRepository
      .findMany(filter)
      .populate("createdBy", "username role")
      .sort({ createdAt: -1 });
    return Promise.resolve(leanQuery(query)).then((bills) =>
      Array.isArray(bills) ? bills : [],
    );
  }
  const { projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions)
    .populate("createdBy", "username role");
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  if (lean === false) return query;
  return Promise.resolve(leanQuery(query)).then((bills) =>
    Array.isArray(bills) ? bills : [],
  );
};

const findScopedWithCreator = (filter, options = {}, scope) => {
  assertBillingScope(scope, filter);
  filter = directBranchFilter(scope, filter);
  return baseRepository
    .findOne(filter, undefined, options)
    .populate("createdBy", "username role");
};

const findScoped = (filter, options = {}, scope) => {
  assertBillingScope(scope, filter);
  filter = directBranchFilter(scope, filter);
  return baseRepository.findOne(filter, undefined, options);
};

const deleteScoped = (filter, options = {}, scope) => {
  assertBillingScope(scope, filter);
  filter = directBranchFilter(scope, filter);
  return baseRepository.deleteOne(filter, options);
};

const listLean = (filter, options = {}) =>
  baseRepository.findMany(normalizeBillingFilter(filter), undefined, options).lean();

const count = (filter = {}, options = {}, scope) => {
  assertBillingScope(scope, filter);
  const normalized = normalizeBillingFilter(filter);
  return baseRepository.count(
    directBranchFilter(scope, normalized),
    options,
  );
};

// Explicit historical compatibility query. This is intentionally not used by
// operational controllers and must only be called by a reviewed archival flow.
const listHistoricalBranchless = (filter = {}, options = {}) =>
  baseRepository.findMany({
    ...normalizeBillingFilter(filter),
    $or: [{ branchId: null }, { branchId: { $exists: false } }],
  }, undefined, options);

module.exports = {
  ...baseRepository,
  countCreatedSince,
  findMaxSequenceForDate,
  createBillDocument,
  createBill,
  listScoped,
  findScopedWithCreator,
  findScoped,
  deleteScoped,
  listLean,
  count,
  normalizeBillingFilter,
  assertBillingScope,
  listHistoricalBranchless,
};
