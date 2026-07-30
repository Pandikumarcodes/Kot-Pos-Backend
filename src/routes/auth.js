const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/users");
const logger = require("../config/logger");
const {
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
} = require("../config/cookieConfig");
const {
  validateSignupData,
  validateStatus,
} = require("../utils/validation");
const {
  userAuth,
  allowRoles,
  getAccessToken,
  verifyAccessToken,
} = require("../middlewares/auth");

const authRouter = express.Router();
const PUBLIC_SIGNUP_ROLE = "waiter";
const REFRESH_TOKEN_ALGORITHMS = ["HS256"];
const DUMMY_PASSWORD_HASH = bcrypt.hash(
  "DummyPasswordForConstantTimeCheck@1",
  12,
);

const AUTH_ERROR = Object.freeze({
  INVALID_CREDENTIALS: "Invalid credentials",
  ACCOUNT_LOCKED: "Account locked",
  ACCOUNT_INACTIVE: "Your account is inactive. Contact admin.",
  NO_REFRESH_TOKEN: "No refresh token",
  INVALID_REFRESH_TOKEN: "Invalid or expired refresh token",
  USER_NOT_FOUND: "User not found",
  SERVER_ERROR: "Server error",
});

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

const normalizeCredentials = (body = {}) => {
  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  return { username, password };
};

const getCredentialInputError = ({ username, password }) => {
  if (!username || !password) {
    return "Username and password are required";
  }
  if (username.length > 254) {
    return "Invalid username or password";
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    return "Password must not exceed 72 bytes";
  }
  return null;
};

const executeQueryWithSelection = async (queryFactory, selection) => {
  const query = queryFactory();
  return query && typeof query.select === "function"
    ? query.select(selection)
    : query;
};

const issueRefreshToken = async (user) => {
  if (typeof user.issueRefreshToken === "function") {
    return user.issueRefreshToken();
  }
  // Keeps compatibility with lightweight model doubles and older integrations.
  return user.getRefreshToken();
};

const clearAuthCookies = (res) => {
  res.clearCookie("token", clearCookieOptions("/"));
  res.clearCookie(
    "refreshToken",
    clearCookieOptions("/api/v1/auth/refresh"),
  );
};

authRouter.post("/signup", signupLimiter, async (req, res) => {
  const { username, password } = normalizeCredentials(req.body);

  try {
    validateSignupData({ username, password });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const inputError = getCredentialInputError({ username, password });
  if (inputError) {
    return res.status(400).json({ error: inputError });
  }

  try {
    const existingUser = await executeQueryWithSelection(
      () => User.findOne({ username }),
      "_id",
    );
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const safeStatus = validateStatus({ status: req.body?.status });
    const newUser = new User({
      username,
      role: PUBLIC_SIGNUP_ROLE,
      password,
      status: safeStatus,
    });
    await newUser.save();

    return res.status(201).json({
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
    if (err?.code === 11000) {
      return res.status(400).json({ error: "Username already exists" });
    }
    if (err?.name === "ValidationError") {
      return res.status(400).json({ error: "Invalid signup data" });
    }
    return res.status(500).json({ error: AUTH_ERROR.SERVER_ERROR });
  }
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = normalizeCredentials(req.body);
  const inputError = getCredentialInputError({ username, password });
  if (inputError) {
    return res.status(400).json({ error: inputError });
  }

  try {
    const user = await executeQueryWithSelection(
      () => User.findOne({ username }),
      "+password",
    );

    // A real bcrypt operation is performed even for unknown usernames to make
    // username probing via response timing substantially harder.
    const isPasswordValid = user
      ? await user.validatePassword(password)
      : await bcrypt.compare(password, await DUMMY_PASSWORD_HASH);

    if (!user || !isPasswordValid) {
      return res
        .status(401)
        .json({ error: AUTH_ERROR.INVALID_CREDENTIALS });
    }
    if (user.status === "locked") {
      return res.status(403).json({ error: AUTH_ERROR.ACCOUNT_LOCKED });
    }
    if (user.status && user.status !== "active") {
      return res.status(403).json({ error: AUTH_ERROR.ACCOUNT_INACTIVE });
    }

    const [accessToken, refreshToken] = await Promise.all([
      user.getJWT(),
      issueRefreshToken(user),
    ]);

    res.cookie("token", accessToken, accessCookieOptions);
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    return res.status(200).json({
      message: `${user.username} Login successful`,
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
    return res.status(500).json({ error: AUTH_ERROR.SERVER_ERROR });
  }
});

authRouter.get(
  "/me",
  userAuth,
  allowRoles(["admin", "manager", "waiter", "chef", "cashier"]),
  (req, res) => {
    return res.status(200).json({
      user: {
        id: req.user._id,
        name: req.user.username,
        email: req.user.username,
        role: req.user.role,
        branchId: req.user.branchId ?? null,
      },
    });
  },
);

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: AUTH_ERROR.NO_REFRESH_TOKEN });
  }

  try {
    const payload = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      { algorithms: REFRESH_TOKEN_ALGORITHMS },
    );
    if (
      !payload ||
      typeof payload !== "object" ||
      !payload._id ||
      (payload.tokenType
        ? payload.tokenType !== "refresh"
        : typeof payload.role === "string")
    ) {
      throw new Error("Invalid refresh token payload");
    }

    const user = await executeQueryWithSelection(
      () => User.findById(payload._id),
      "+refreshTokenHash",
    );
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: AUTH_ERROR.USER_NOT_FOUND });
    }
    if (user.status !== "active") {
      if (typeof user.revokeRefreshToken === "function") {
        await user.revokeRefreshToken();
      }
      clearAuthCookies(res);
      return res.status(403).json({ error: AUTH_ERROR.ACCOUNT_INACTIVE });
    }
    if (
      typeof user.matchesRefreshToken === "function" &&
      !user.matchesRefreshToken(refreshToken)
    ) {
      clearAuthCookies(res);
      return res
        .status(401)
        .json({ error: AUTH_ERROR.INVALID_REFRESH_TOKEN });
    }

    const [newAccessToken, newRefreshToken] = await Promise.all([
      user.getJWT(),
      issueRefreshToken(user),
    ]);

    res.cookie("token", newAccessToken, accessCookieOptions);
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
    return res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
    logger.error("[auth/refresh]", { message: err.message });
    clearAuthCookies(res);
    return res.status(401).json({ error: AUTH_ERROR.INVALID_REFRESH_TOKEN });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const token = getAccessToken(req);
    if (token) {
      const payload = verifyAccessToken(token);
      await User.updateOne(
        { _id: payload._id },
        { $set: { refreshTokenHash: null } },
      );
    }
  } catch (err) {
    // Logout remains idempotent even if the session has already expired.
    logger.warn("[auth/logout]", { message: err.message });
  }

  clearAuthCookies(res);
  return res.status(200).json({ message: "Logout successful" });
});

module.exports = { authRouter, authMiddleware: userAuth };
