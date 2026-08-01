const billingService = require("../services/billingService");
const { forwardError } = require("./controllerUtils");

const createBill = async (req, res, next) => {
  try {
    const bill = await billingService.createBill(req.body, {
      userId: req.user._id,
      branchId: req.branchId,
      io: req.app.get("io"),
    });
    res.status(201).json({ message: "Bill generated successfully", bill });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};

const getBills = async (req, res, next) => {
  try {
    const { branchId: _branchId, ...query } = req.query;
    const result = await billingService.listBills({
      query,
      scopeToBranchMembers: req.scopeToBranchMembers,
    });
    res.status(200).json({
      myBills: result.items,
      ...(result.pagination && { pagination: result.pagination }),
    });
  } catch (err) {
    forwardError(next, err, "Failed to fetch Bills");
  }
};

const getBill = async (req, res, next) => {
  try {
    res
      .status(200)
      .json({
        bill: await billingService.getBill(
          req.params.billId,
          req.scopeToBranchMembers,
        ),
      });
  } catch (err) {
    forwardError(next, err, "Failed to fetch Bill");
  }
};

const payBill = async (req, res, next) => {
  try {
    const bill = await billingService.payBill(
      req.params.billId,
      req.body?.paymentMethod ?? null,
      {
        scopeToBranchMembers: req.scopeToBranchMembers,
        branchId: req.branchId,
        io: req.app.get("io"),
      },
    );
    res.status(200).json({ message: "Bill marked as paid successfully", bill });
  } catch (err) {
    forwardError(next, err, "Failed to update bill payment status");
  }
};

const deleteBill = async (req, res, next) => {
  try {
    const bill = await billingService.deleteBill(
      req.params.billId,
      req.scopeToBranchMembers,
    );
    res.status(200).json({ message: "Bill deleted successfully", bill });
  } catch (err) {
    forwardError(next, err);
  }
};

module.exports = { createBill, getBills, getBill, payBill, deleteBill };
