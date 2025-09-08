const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      minlength: 3,
    },
    password: {
      type: String,
      required: true,
      minlength: 5,
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

module.exports = mongoose.model("User", userSchema);
