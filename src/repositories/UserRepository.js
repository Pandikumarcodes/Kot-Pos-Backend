const createBaseRepository = require("./BaseRepository");
const User = require("../models/users");

const baseRepository = createBaseRepository(User);

const findByUsername = (username, selection) => {
  const query = baseRepository.findOne({ username });
  return selection && query && typeof query.select === "function"
    ? query.select(selection)
    : query;
};

const findByIdWithSelection = (id, selection) => {
  const query = baseRepository.findById(id);
  return selection && query && typeof query.select === "function"
    ? query.select(selection)
    : query;
};

const createUserDocument = (data) => baseRepository.createDocument(data);

const findByScope = (filter) =>
  baseRepository.findMany(filter).select("-password");

const updateRole = (filter, role) =>
  User.findOneAndUpdate(
    filter,
    { role },
    { new: true, runValidators: true, select: "-password" },
  );

const deleteByScope = (filter) => User.findOneAndDelete(filter);

const clearRefreshToken = (userId) =>
  baseRepository.updateOne(
    { _id: userId },
    { $set: { refreshTokenHash: null } },
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
