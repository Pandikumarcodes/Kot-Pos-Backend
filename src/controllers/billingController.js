const billingService = require("../services/billingService");
const { forwardError } = require("./controllerUtils");
const logger = require("../config/logger");

const createBill = async (req, res, next) => {
  try {
    const bill = await billingService.createBill(req.body, {
      userId: req.user._id,
      branchId: req.accessScope.branchId,
      scope: req.accessScope,
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
      scope: req.accessScope,
    });
    res.status(200).json({
      myBills: result.items,
      ...(result.pagination && { pagination: result.pagination }),
    });
  } catch (err) {
    logger.error("Cashier bills repository failure", {
      name: err?.name,
      message: err?.message,
      code: err?.code ?? null,
      stack: err?.stack,
      branchId: req.accessScope?.branchId ?? null,
      route: req.route?.path ?? req.path,
      page: req.query?.page ?? null,
      limit: req.query?.limit ?? null,
      sort: req.query?.sort ?? null,
      order: req.query?.order ?? null,
    });
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
          req.accessScope,
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
        scope: req.accessScope,
        branchId: req.accessScope.branchId,
        userId: req.user?._id,
        actorRole: req.user?.role,
        io: req.app.get("io"),
      },
    );
    res.status(200).json({ message: "Bill marked as paid successfully", bill });
  } catch (err) {
    forwardError(next, err, "Failed to update bill payment status", 500);
  }
};

const deleteBill = async (req, res, next) => {
  try {
    const bill = await billingService.deleteBill(
      req.params.billId,
      req.accessScope,
    );
    res.status(200).json({ message: "Bill deleted successfully", bill });
  } catch (err) {
    forwardError(next, err);
  }
};

module.exports = { createBill, getBills, getBill, payBill, deleteBill };
