const createBaseRepository = require("./BaseRepository");
const User = require("../models/users");

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

const findByScope = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).select("-password");

const updateRole = (filter, role, options = {}) =>
  User.findOneAndUpdate(
    filter,
    { role },
    { new: true, runValidators: true, select: "-password", ...options },
  );

const deleteByScope = (filter, options = {}) =>
  baseRepository.deleteOne(filter, options);

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
  updateRole,
  deleteByScope,
  clearRefreshToken,
};
