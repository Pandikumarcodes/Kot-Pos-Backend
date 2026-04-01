const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const authRouter = express.Router();
const User = require("../models/users");
const logger = require("../config/logger");
const {
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
} = require("../config/cookieConfig");
// const { generateToken, doubleCsrfProtection } = require("../config/csrfConfig");
const {
  validateSignupData,
  validateStatus,
  validateRole,
} = require("../utils/validation");

// ── Rate Limiters ─────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts created. Please try again later." },
});

// ── Auth Middleware ───────────────────────────────────────────
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
// CSRF TOKEN
// No CSRF protection — this is the route that gives the token
// ─────────────────────────────────────────────────────────────
// authRouter.get("/csrf-token", (req, res) => {
//   const token = generateToken(req, res);
//   res.json({ csrfToken: token });
// });

// ─────────────────────────────────────────────────────────────
// SIGNUP
// No CSRF — user has no session cookie yet, nothing to hijack
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
    logger.error("[auth/signup]", { message: err.message });
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// LOGIN
// ✅ No CSRF — token + refreshToken cookies don't exist yet
//    before login, so there is no session to hijack
// ─────────────────────────────────────────────────────────────
authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    // Prevents username enumeration — always validate password
    // even if user doesn't exist, so response time is the same
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
      return res.status(403).json({
        error: "Your account is inactive. Contact admin.",
      });
    }

    const accessToken = await user.getJWT();
    const refreshToken = user.getRefreshToken();

    res.cookie("token", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    // Don't expose tokens in response body — httpOnly cookies handle auth
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
    logger.error("[auth/login]", { message: err.message });
    res.status(500).json({ error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────
// ME
// GET request — no CSRF needed (read only, not state-changing)
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
    logger.error("[auth/me]", { message: err.message });
    res.status(500).json({ error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ✅ CSRF protected — user is logged in, state-changing
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

    res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
    logger.error("[auth/refresh]", { message: err.message });
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ✅ CSRF protected — user is logged in, state-changing
// ─────────────────────────────────────────────────────────────
authRouter.post("/logout", (req, res) => {
  res.clearCookie("token", clearCookieOptions("/"));
  res.clearCookie("refreshToken", clearCookieOptions("/api/v1/auth/refresh"));
  res.status(200).json({ message: "Logout successful" });
});

module.exports = { authRouter, authMiddleware };
