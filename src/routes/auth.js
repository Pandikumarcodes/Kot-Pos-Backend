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
  validateLogin,
  validateSignup,
} = require("../validators/authentication");
const {
  userAuth,
  allowRoles,
  getAccessToken,
  verifyAccessToken,
} = require("../middlewares/auth");
const {
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} = require("../utils/apiResponse");

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

authRouter.post("/signup", signupLimiter, validateSignup, async (req, res) => {
  const { username, password, status } = req.body;
  try {
    const existingUser = await executeQueryWithSelection(
      () => User.findOne({ username }),
      "_id",
    );
    if (existingUser) {
      return badRequest(res, "Username already exists");
    }

    const newUser = new User({
      username,
      role: PUBLIC_SIGNUP_ROLE,
      password,
      status,
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
      return badRequest(res, "Username already exists");
    }
    if (err?.name === "ValidationError") {
      return badRequest(res, "Invalid signup data");
    }
    return serverError(res, AUTH_ERROR.SERVER_ERROR);
  }
});

authRouter.post("/login", loginLimiter, validateLogin, async (req, res) => {
  const { username, password } = req.body;
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
      return unauthorized(res, AUTH_ERROR.INVALID_CREDENTIALS);
    }
    if (user.status === "locked") {
      return forbidden(res, AUTH_ERROR.ACCOUNT_LOCKED);
    }
    if (user.status && user.status !== "active") {
      return forbidden(res, AUTH_ERROR.ACCOUNT_INACTIVE);
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
    return serverError(res, AUTH_ERROR.SERVER_ERROR);
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
    return unauthorized(res, AUTH_ERROR.NO_REFRESH_TOKEN);
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
      return unauthorized(res, AUTH_ERROR.USER_NOT_FOUND);
    }
    if (user.status !== "active") {
      if (typeof user.revokeRefreshToken === "function") {
        await user.revokeRefreshToken();
      }
      clearAuthCookies(res);
      return forbidden(res, AUTH_ERROR.ACCOUNT_INACTIVE);
    }
    if (
      typeof user.matchesRefreshToken === "function" &&
      !user.matchesRefreshToken(refreshToken)
    ) {
      clearAuthCookies(res);
      return unauthorized(res, AUTH_ERROR.INVALID_REFRESH_TOKEN);
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
    return unauthorized(res, AUTH_ERROR.INVALID_REFRESH_TOKEN);
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
