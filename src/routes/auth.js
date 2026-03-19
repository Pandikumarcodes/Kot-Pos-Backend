const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const authRouter = express.Router();
const User = require("../models/users");

const {
  validateSignupData,
  validateStatus,
  validateRole,
} = require("../utils/validation");

const isProduction = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────────
// Cookie options — single source of truth
// ─────────────────────────────────────────────────────────────
const accessCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// FIX #9 — moved clearCookieOptions to top with other cookie options
const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 0,
};

// ─────────────────────────────────────────────────────────────
// Rate limiter — FIX #5
// Prevents brute-force attacks on login and signup
// ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 10, // max 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1-hour window
  max: 5, // max 5 signups per hour per IP
  message: { error: "Too many accounts created. Please try again later." },
});

// ─────────────────────────────────────────────────────────────
// Auth middleware — FIX #3
// Single shared middleware instead of duplicating token logic in every route
// ─────────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token =
    req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ─────────────────────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────────────────────
authRouter.post("/signup", signupLimiter, async (req, res) => {
  try {
    validateSignupData(req.body);

    const { username, role, password, status } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
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
    // FIX #7 — consistent error logging across all routes
    console.error("[auth/signup]", err);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    // prevents username enumeration attacks
    const isPasswordValid = user
      ? await user.validatePassword(password)
      : false;
    if (!user || !isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status === "locked") {
      return res.status(403).json({ error: "Account locked" });
    }

    if (user.status !== "active") {
      return res
        .status(403)
        .json({ error: "Your account is inactive. Contact admin." });
    }

    const accessToken = await user.getJWT();
    const refreshToken = user.getRefreshToken();

    res.cookie("token", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    // httpOnly cookies handle auth; exposing token in body risks XSS theft
    res.status(200).json({
      message: `${username} Login successful`,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
        branchId: user.branchId ?? null,
      },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────
// ME — get current user from token
// ─────────────────────────────────────────────────────────────

authRouter.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.username,
        email: user.username,
        role: user.role,
        branchId: user.branchId ?? null,
      },
    });
  } catch (err) {
    console.error("[auth/me]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────────────────────
authRouter.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(payload._id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const newAccessToken = await user.getJWT();
    const newRefreshToken = user.getRefreshToken();

    res.cookie("token", newAccessToken, accessCookieOptions);
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);

    res.status(200).json({
      message: "Token refreshed",
      token: newAccessToken,
    });
  } catch (err) {
    console.error("[auth/refresh]", err);
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────

authRouter.post("/logout", (req, res) => {
  res.cookie("token", "", clearCookieOptions);
  res.cookie("refreshToken", "", clearCookieOptions);
  res.status(200).json({ message: "Logout successful" });
});

module.exports = { authRouter, authMiddleware };
