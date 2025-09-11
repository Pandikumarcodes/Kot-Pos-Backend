const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const secretKey = "Pandi";

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
      enum: ["admin", "waiter", "chef"],
      default: "waiter",
    },
    status: {
      type: String,
      enum: ["active", "locked", "accepted"],
      default: "active",
    },
  },
  { timestamps: true }
);

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

userSchema.methods.getJWT = async function () {
  const user = this;
  const token = jwt.sign(
    { _id: user._id, username: this.username, role: this.role },
    secretKey,
    { expiresIn: "8h" }
  );
  return token;
};

userSchema.methods.validatePassword = async function (passwordInputByUser) {
  const isPasswordValid = await bcrypt.compare(
    passwordInputByUser,
    this.password
  );
  return isPasswordValid;
};

// userSchema.methods.isValidPassword = async function (inputPassword) {
//   return await bcrypt.compare(inputPassword, this.password);
// };

module.exports = mongoose.model("User", userSchema);
