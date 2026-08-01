const branchService = require("../services/branchService");
const { forwardError } = require("./controllerUtils");

const listBranches = async (req, res, next) => {
  try {
    res.json({ branches: await branchService.listBranches() });
  } catch (err) {
    forwardError(next, err);
  }
};
const createBranch = async (req, res, next) => {
  try {
    const branch = await branchService.createBranch(req.body);
    res.status(201).json({ message: "Branch created", branch });
  } catch (err) {
    forwardError(next, err);
  }
};
const updateBranch = async (req, res, next) => {
  try {
    const branch = await branchService.updateBranch(req.params.id, req.body);
    res.json({ message: "Branch updated", branch });
  } catch (err) {
    forwardError(next, err);
  }
};
const deactivateBranch = async (req, res, next) => {
  try {
    const branch = await branchService.deactivateBranch(req.params.id);
    res.json({ message: "Branch deactivated", branch });
  } catch (err) {
    forwardError(next, err);
  }
};
const assignStaff = async (req, res, next) => {
  try {
    const { branch, user } = await branchService.assignStaff(
      req.params.id,
      req.body.userId,
    );
    res.json({ message: `${user.username} assigned to ${branch.name}`, user });
  } catch (err) {
    forwardError(next, err);
  }
};
const removeStaff = async (req, res, next) => {
  try {
    const user = await branchService.removeStaff(
      req.params.id,
      req.body.userId,
    );
    res.json({ message: `${user.username} removed from branch`, user });
  } catch (err) {
    forwardError(next, err);
  }
};
const listBranchStaff = async (req, res, next) => {
  try {
    res.json({ users: await branchService.listBranchStaff(req.params.id) });
  } catch (err) {
    forwardError(next, err);
  }
};
const listUnassignedStaff = async (req, res, next) => {
  try {
    res.json({ users: await branchService.listUnassignedStaff() });
  } catch (err) {
    forwardError(next, err);
  }
};
const getBranchSummary = async (req, res, next) => {
  try {
    res.json(await branchService.getBranchSummary(req.params.id));
  } catch (err) {
    forwardError(next, err);
  }
};

module.exports = {
  listBranches,
  createBranch,
  updateBranch,
  deactivateBranch,
  assignStaff,
  removeStaff,
  listBranchStaff,
  listUnassignedStaff,
  getBranchSummary,
};
