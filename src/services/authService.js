const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const AppError = require("../utils/AppError");

const PUBLIC_SIGNUP_ROLE = "waiter";
const REFRESH_TOKEN_ALGORITHMS = ["HS256"];
const DUMMY_PASSWORD_HASH = bcrypt.hash("DummyPasswordForConstantTimeCheck@1", 12);

const executeQueryWithSelection = async (queryFactory, selection) => {
  const query = queryFactory();
  return query && typeof query.select === "function" ? query.select(selection) : query;
};

const issueRefreshToken = (user) =>
  typeof user.issueRefreshToken === "function" ? user.issueRefreshToken() : user.getRefreshToken();

const signup = async ({ username, password, status }) => {
  const existing = await executeQueryWithSelection(() => User.findOne({ username }), "_id");
  if (existing) throw new AppError("Username already exists", 400);
  const user = new User({ username, role: PUBLIC_SIGNUP_ROLE, password, status });
  try {
    await user.save();
  } catch (err) {
    if (err?.code === 11000) throw new AppError("Username already exists", 400);
    if (err?.name === "ValidationError") throw new AppError("Invalid signup data", 400);
    throw err;
  }
  return { id: user._id, username: user.username, role: user.role, status: user.status };
};

const login = async ({ username, password }) => {
  const user = await executeQueryWithSelection(() => User.findOne({ username }), "+password");
  const validPassword = user
    ? await user.validatePassword(password)
    : await bcrypt.compare(password, await DUMMY_PASSWORD_HASH);
  if (!user || !validPassword) throw new AppError("Invalid credentials", 401);
  if (user.status === "locked") throw new AppError("Account locked", 403);
  if (user.status && user.status !== "active") {
    throw new AppError("Your account is inactive. Contact admin.", 403);
  }
  const [accessToken, refreshToken] = await Promise.all([user.getJWT(), issueRefreshToken(user)]);
  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      status: user.status,
      branchId: user.branchId ?? null,
    },
  };
};

const refresh = async (refreshToken) => {
  if (!refreshToken) throw new AppError("No refresh token", 401);
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, { algorithms: REFRESH_TOKEN_ALGORITHMS });
  } catch (err) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  if (!payload || typeof payload !== "object" || !payload._id ||
      (payload.tokenType ? payload.tokenType !== "refresh" : typeof payload.role === "string")) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  const user = await executeQueryWithSelection(() => User.findById(payload._id), "+refreshTokenHash");
  if (!user) throw new AppError("User not found", 401);
  if (user.status !== "active") {
    if (typeof user.revokeRefreshToken === "function") await user.revokeRefreshToken();
    throw new AppError("Your account is inactive. Contact admin.", 403);
  }
  if (typeof user.matchesRefreshToken === "function" && !user.matchesRefreshToken(refreshToken)) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  const [accessToken, newRefreshToken] = await Promise.all([user.getJWT(), issueRefreshToken(user)]);
  return { accessToken, refreshToken: newRefreshToken };
};

const logout = async (token, verifyAccessToken) => {
  if (!token) return;
  try {
    const payload = verifyAccessToken(token);
    await User.updateOne({ _id: payload._id }, { $set: { refreshTokenHash: null } });
  } catch (err) {
    // Logout is intentionally idempotent for expired or invalid sessions.
  }
};

module.exports = { signup, login, refresh, logout };
