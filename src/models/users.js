const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const BCRYPT_ROUNDS = 12;
const TOKEN_ALGORITHM = "HS256";

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      minlength: 3,
      maxlength: 254,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 5,
      select: false,
      validate(value) {
        if (Buffer.byteLength(value, "utf8") > 72) {
          throw new Error("Password must not exceed 72 bytes");
        }
        if (!validator.isStrongPassword(value)) {
          throw new Error("Enter a strong password");
        }
      },
    },
    role: {
      type: String,
      enum: ["admin", "waiter", "chef", "cashier", "manager"],
      default: "waiter",
    },
    status: {
      type: String,
      enum: ["active", "locked", "accepted"],
      default: "active",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.getJWT = async function () {
  return jwt.sign(
    {
      _id: this._id,
      username: this.username,
      role: this.role,
      branchId: this.branchId ?? null,
      tokenType: "access",
    },
    process.env.JWT_SECRET,
    { algorithm: TOKEN_ALGORITHM, expiresIn: "15m" },
  );
};

userSchema.methods.getRefreshToken = function () {
  return jwt.sign(
    { _id: this._id, tokenType: "refresh" },
    process.env.REFRESH_TOKEN_SECRET,
    {
      algorithm: TOKEN_ALGORITHM,
      expiresIn: "7d",
      jwtid: crypto.randomUUID(),
    },
  );
};

userSchema.methods.issueRefreshToken = async function () {
  const token = this.getRefreshToken();
  this.refreshTokenHash = hashRefreshToken(token);
  await this.save({ validateBeforeSave: false });
  return token;
};

userSchema.methods.matchesRefreshToken = function (token) {
  if (!this.refreshTokenHash || typeof token !== "string") {
    return false;
  }

  const presentedHash = Buffer.from(hashRefreshToken(token), "hex");
  const storedHash = Buffer.from(this.refreshTokenHash, "hex");

  return (
    presentedHash.length === storedHash.length &&
    crypto.timingSafeEqual(presentedHash, storedHash)
  );
};

userSchema.methods.revokeRefreshToken = async function () {
  this.refreshTokenHash = null;
  await this.save({ validateBeforeSave: false });
};

userSchema.methods.validatePassword = async function (passwordInputByUser) {
  if (
    typeof passwordInputByUser !== "string" ||
    typeof this.password !== "string"
  ) {
    return false;
  }
  return bcrypt.compare(passwordInputByUser, this.password);
};

module.exports = mongoose.model("User", userSchema);
