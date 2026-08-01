const userService = require("../services/userService");
const { forwardError } = require("./controllerUtils");

const createUser = async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body, req.branchId);
    res.status(201).json({ message: "New user created successfully", user });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const listUsers = async (req, res, next) => {
  try {
    res
      .status(200)
      .json({ users: await userService.listUsers(req.branchFilter) });
  } catch (err) {
    forwardError(next, err, "Failed to fetch users");
  }
};
const updateUserRole = async (req, res, next) => {
  try {
    const user = await userService.updateUserRole({
      userId: req.params.userId,
      role: req.body.role,
      actorRole: req.user.role,
      scopeToBranch: req.scopeToBranch,
    });
    res.status(200).json({ message: "User role updated successfully", user });
  } catch (err) {
    forwardError(next, err, "Failed to update user role");
  }
};
const deleteUser = async (req, res, next) => {
  try {
    const user = await userService.deleteUser(
      req.params.userId,
      req.scopeToBranch,
    );
    res.status(200).json({ message: "User deleted successfully", user });
  } catch (err) {
    forwardError(next, err);
  }
};
module.exports = { createUser, listUsers, updateUserRole, deleteUser };
