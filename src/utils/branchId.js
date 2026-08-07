const mongoose = require("mongoose");

class BranchIdError extends Error {
  constructor(message = "Invalid branchId") {
    super(message);
    this.name = "BranchIdError";
    this.status = 400;
  }
}

const serializedBufferToHex = (value) => {
  if (!value || typeof value !== "object") return null;
  const keys = Object.keys(value);
  if (keys.length !== 12 || keys.some((key) => !/^\d+$/.test(key))) {
    return null;
  }
  const bytes = keys
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => value[key]);
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    return null;
  }
  return Buffer.from(bytes).toString("hex");
};

const normalizeBranchId = (value, { allowMissing = false } = {}) => {
  if (value === null || value === undefined || value === "") {
    if (allowMissing) return null;
    throw new BranchIdError();
  }

  let normalized;
  if (typeof value === "string") {
    normalized = value;
  } else if (mongoose.isValidObjectId(value)) {
    normalized = value.toString();
  } else if (value && typeof value === "object" && value.$oid) {
    normalized = value.$oid;
  } else if (value && typeof value === "object") {
    normalized = serializedBufferToHex(value.buffer);
  }

  if (!normalized || !mongoose.isValidObjectId(normalized)) {
    throw new BranchIdError();
  }
  return normalized.toLowerCase();
};

const normalizeObjectId = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof mongoose.Types.ObjectId) return value.toString();

  if (value && typeof value === "object" && value._id !== undefined) {
    return normalizeObjectId(value._id);
  }

  if (typeof value === "string") {
    return mongoose.isValidObjectId(value) && value.length === 24
      ? value.toLowerCase()
      : null;
  }

  if (value && typeof value === "object" && value.$oid) {
    return normalizeObjectId(value.$oid);
  }

  const hex = serializedBufferToHex(value?.buffer);
  return hex && mongoose.isValidObjectId(hex) ? hex : null;
};

module.exports = { BranchIdError, normalizeBranchId, normalizeObjectId };
