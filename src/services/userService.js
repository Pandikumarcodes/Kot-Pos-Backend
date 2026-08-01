const User = require("../models/users");
const AppError = require("../utils/AppError");

const createUser = async ({ username, role, password, status }, branchId) => {
  if (await User.findOne({ username })) throw new AppError("username already exists", 400);
  const user = new User({ username, role, password, status, branchId });
  await user.save();
  return { id: user._id, username: user.username, role: user.role, status: user.status };
};

const listUsers = async (branchFilter) => {
  const users = await User.find(branchFilter).select("-password");
  if (!users.length) throw new AppError("No users found", 404);
  return users;
};

const updateUserRole = async ({ userId, role, actorRole, scopeToBranch }) => {
  if (actorRole === "manager" && role === "admin") {
    throw new AppError("Managers cannot assign admin role", 403);
  }
  const user = await User.findOneAndUpdate(
    scopeToBranch({ _id: userId }),
    { role },
    { new: true, runValidators: true, select: "-password" },
  );
  if (!user) throw new AppError("User not found", 404);
  return { id: user._id, username: user.username, newRole: user.role };
};

const deleteUser = async (userId, scopeToBranch) => {
  const user = await User.findOneAndDelete(scopeToBranch({ _id: userId }));
  if (!user) throw new AppError("User not found", 404);
  return { id: user._id, username: user.username };
};

module.exports = { createUser, listUsers, updateUserRole, deleteUser };
