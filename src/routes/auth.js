const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authRouter = express.Router();
const User = require("../models/users");

const {
  validateSignupData,
  validateStatus,
  validateRole,
} = require("../utils/validation");

const isProduction = process.env.NODE_ENV === "production";

// ── Cookie options ────────────────────────────────────────────
const cookieOptions = {
  httpOnly: true,
  secure: isProduction, // ✅ HTTPS only in production
  sameSite: isProduction ? "none" : "lax", // ✅ cross-origin in production
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
};

// ── SIGNUP ───────────────────────────────────────────────────
authRouter.post("/signup", async (req, res) => {
  try {
    validateSignupData(req.body);

    const { username, role, password, status } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "username already exists" });
    }

    const safeRole = validateRole({ role });
    const safeStatus = validateStatus({ status });

    const newUser = new User({
      username,
      role: safeRole,
      password,
      status: safeStatus,
    });
    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── LOGIN ────────────────────────────────────────────────────
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    if (user.status !== "active") {
      return res
        .status(403)
        .json({ error: "Your account is inactive. Contact admin." });
    }

    const token = await user.getJWT();

    // ✅ Fixed cookie — works cross-origin in production
    res.cookie("token", token, cookieOptions);

    res.status(200).json({
      message: `${username} Login successful`,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── ME ───────────────────────────────────────────────────────
authRouter.get("/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // ✅ Use JWT_SECRET from env not hardcoded "Pandi"
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload._id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.username,
        email: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// ── LOGOUT ───────────────────────────────────────────────────
authRouter.post("/logout", async (req, res) => {
  try {
    // ✅ Clear cookie properly with same options
    res.cookie("token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 0, // expire immediately
    });
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { authRouter };
