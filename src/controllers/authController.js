const authService = require("../services/authService");
const logger = require("../config/logger");
const {
  accessCookieOptions,
  refreshCookieOptions,
  clearCookieOptions,
} = require("../config/cookieConfig");
const { getAccessToken, verifyAccessToken } = require("../middlewares/auth");
const { forwardError } = require("./controllerUtils");

const clearAuthCookies = (res) => {
  res.clearCookie("token", clearCookieOptions("/"));
  res.clearCookie("refreshToken", clearCookieOptions("/api/v1/auth/refresh"));
};

const signup = async (req, res, next) => {
  try {
    const user = await authService.signup(req.body);
    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    logger.error("[auth/signup]", { message: err.message });
    forwardError(next, err, "Server error");
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.cookie("token", result.accessToken, accessCookieOptions);
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);
    res
      .status(200)
      .json({
        message: `${result.user.username} Login successful`,
        user: result.user,
      });
  } catch (err) {
    logger.error("[auth/login]", { message: err.message });
    forwardError(next, err, "Server error");
  }
};

const me = (req, res) =>
  res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.username,
      email: req.user.username,
      role: req.user.role,
      branchId: req.user.branchId ?? null,
    },
  });

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refresh(req.cookies?.refreshToken);
    res.cookie("token", result.accessToken, accessCookieOptions);
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);
    res.status(200).json({ message: "Token refreshed" });
  } catch (err) {
    logger.error("[auth/refresh]", { message: err.message });
    clearAuthCookies(res);
    forwardError(next, err, "Invalid or expired refresh token", 401);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(getAccessToken(req), verifyAccessToken);
    clearAuthCookies(res);
    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    forwardError(next, err);
  }
};

module.exports = { signup, login, me, refresh, logout };
