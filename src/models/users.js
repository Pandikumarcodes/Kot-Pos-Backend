const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      minlength: 3,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 5,
      validate(value) {
        if (!validator.isStrongPassword(value)) {
          throw new Error("Enter a strong password " + value);
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
  },
  { timestamps: true },
);

// ── Hash password before save ─────────────────────────────────
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();
    const saltRounds = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Access Token — 15 mins ────────────────────────────────────
userSchema.methods.getJWT = async function () {
  const token = jwt.sign(
    { _id: this._id, username: this.username, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }, // ✅ short lived
  );
  return token;
};

// ── Refresh Token — 7 days ────────────────────────────────────
userSchema.methods.getRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }, // ✅ long lived
  );
};

// ── Validate password ─────────────────────────────────────────
userSchema.methods.validatePassword = async function (passwordInputByUser) {
  return await bcrypt.compare(passwordInputByUser, this.password);
};

module.exports = mongoose.model("User", userSchema);
