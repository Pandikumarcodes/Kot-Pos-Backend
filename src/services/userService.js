const userRepository = require("../repositories/UserRepository");
const AppError = require("../utils/AppError");

const createUser = async ({ username, role, password, status }, branchId) => {
  if (await userRepository.findByUsername(username))
    throw new AppError("username already exists", 400);
  const user = await userRepository.createUserDocument({
    username,
    role,
    password,
    status,
    branchId,
  });
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    status: user.status,
  };
};

const listUsers = async (branchFilter) => {
  const users = await userRepository.findByScope(branchFilter);
  if (!users.length) throw new AppError("No users found", 404);
  return users;
};

const updateUserRole = async ({ userId, role, actorRole, scopeToBranch }) => {
  if (actorRole === "manager" && role === "admin") {
    throw new AppError("Managers cannot assign admin role", 403);
  }
  const user = await userRepository.updateRole(
    scopeToBranch({ _id: userId }),
    role,
  );
  if (!user) throw new AppError("User not found", 404);
  return { id: user._id, username: user.username, newRole: user.role };
};

const deleteUser = async (userId, scopeToBranch) => {
  const user = await userRepository.deleteByScope(
    scopeToBranch({ _id: userId }),
  );
  if (!user) throw new AppError("User not found", 404);
  return { id: user._id, username: user.username };
};

module.exports = { createUser, listUsers, updateUserRole, deleteUser };
