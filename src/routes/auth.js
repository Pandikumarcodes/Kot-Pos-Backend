const express = require("express");
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
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.status === "locked")
      return res.status(403).json({ error: "Account locked" });
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    if (user.status !== "active") {
      return res
        .status(403)
        .json({ error: "Your account is inactive. Contact admin." });
    }

    // ✅ Generate both tokens
    const accessToken = await user.getJWT();
    const refreshToken = user.getRefreshToken();

    // ✅ Set both cookies
    res.cookie("token", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    res.status(200).json({
      message: `${username} Login successful`,
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
        branchId: user.branchId ?? null,
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
    const token =
      req.cookies.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

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
        branchId: user.branchId ?? null,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// ── REFRESH TOKEN ────────────────────────────────────────────
authRouter.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    // ✅ Verify refresh token
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(payload._id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // ✅ Generate new access token
    const newAccessToken = await user.getJWT();
    res.cookie("token", newAccessToken, accessCookieOptions);

    res.status(200).json({
      message: "Token refreshed",
      token: newAccessToken,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// ── LOGOUT ───────────────────────────────────────────────────
authRouter.post("/logout", async (req, res) => {
  try {
    // ✅ Clear both cookies
    const clearOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 0,
    };
    res.cookie("token", "", clearOptions);
    res.cookie("refreshToken", "", clearOptions);
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { authRouter };
