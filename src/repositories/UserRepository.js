const createBaseRepository = require("./BaseRepository");
const User = require("../models/users");
const { leanQuery } = require("./readQuery");
const { assertScope } = require("../utils/accessScope");

const accessFilter = (scope, filter = {}) => {
  const valid = assertScope(scope);
  return valid.type === "branch"
    ? { ...filter, branchId: valid.branchId }
    : { ...filter };
};

const baseRepository = createBaseRepository(User);

const findByUsername = (username, selection, options = {}) => {
  const query = baseRepository.findOne({ username }, undefined, options);
  return selection && query && typeof query.select === "function"
    ? query.select(selection)
    : query;
};

const findByIdWithSelection = (id, selection, options = {}) => {
  const query = baseRepository.findById(id, undefined, options);
  return selection && query && typeof query.select === "function"
    ? query.select(selection)
    : query;
};

const createUserDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const findByScope = (filter, options = {}) => {
  if (!Object.keys(options).length) {
    return leanQuery(baseRepository.findMany(filter).select("-password"));
  }
  const { projection, sort, skip, limit, lean, ...queryOptions } = options;
  let query = baseRepository.findMany(filter, projection, queryOptions);
  if (!projection || !Object.keys(projection).length) {
    query = query.select("-password -refreshTokenHash");
  }
  if (sort) query = query.sort(sort);
  if (skip !== undefined) query = query.skip(skip);
  if (limit !== undefined) query = query.limit(limit);
  return lean === false ? query : leanQuery(query);
};

const findByAccess = ({ scope, filter = {}, options = {} } = {}) =>
  findByScope(accessFilter(scope, filter), options);

const findOneByAccess = (scope, filter = {}, options = {}) =>
  baseRepository.findOne(accessFilter(scope, filter), undefined, options);

const countByAccess = (scope, filter = {}, options = {}) =>
  baseRepository.count(accessFilter(scope, filter), options);

const updateRole = (filter, role, options = {}) =>
  User.findOneAndUpdate(
    filter,
    { role },
    { new: true, runValidators: true, select: "-password", ...options },
);

const updateRoleByAccess = (scope, filter, role, options = {}) =>
  updateRole(accessFilter(scope, filter), role, options);

const deleteByScope = (filter, options = {}) =>
  baseRepository.deleteOne(filter, options);

const deleteByAccess = (scope, filter, options = {}) =>
  deleteByScope(accessFilter(scope, filter), options);

const clearRefreshToken = (userId, options = {}) =>
  baseRepository.updateOne(
    { _id: userId },
    { $set: { refreshTokenHash: null } },
    options,
  );

module.exports = {
  ...baseRepository,
  findByUsername,
  findByIdWithSelection,
  createUserDocument,
  findByScope,
  findByAccess,
  findOneByAccess,
  countByAccess,
  updateRole,
  updateRoleByAccess,
  deleteByScope,
  deleteByAccess,
  clearRefreshToken,
};
