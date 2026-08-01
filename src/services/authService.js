const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/UserRepository");
const AppError = require("../utils/AppError");
const administrationAudit = require("../modules/administration/AdministrationAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

const PUBLIC_SIGNUP_ROLE = "waiter";
const REFRESH_TOKEN_ALGORITHMS = ["HS256"];
const DUMMY_PASSWORD_HASH = bcrypt.hash(
  "DummyPasswordForConstantTimeCheck@1",
  12,
);

const issueRefreshToken = (user) =>
  typeof user.issueRefreshToken === "function"
    ? user.issueRefreshToken()
    : user.getRefreshToken();

const signup = async ({ username, password, status }) => {
  const existing = await userRepository.findByUsername(username, "_id");
  if (existing) throw new AppError("Username already exists", 400);
  let user;
  try {
    user = await userRepository.createUserDocument({
      username,
      role: PUBLIC_SIGNUP_ROLE,
      password,
      status,
    });
  } catch (err) {
    if (err?.code === 11000) throw new AppError("Username already exists", 400);
    if (err?.name === "ValidationError")
      throw new AppError("Invalid signup data", 400);
    throw err;
  }
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    status: user.status,
  };
};

const login = async ({ username, password }, audit = {}) => {
  let context = administrationAudit.createContext(audit);
  let user = null;
  try {
  user = await userRepository.findByUsername(username, "+password");
  const validPassword = user
    ? await user.validatePassword(password)
    : await bcrypt.compare(password, await DUMMY_PASSWORD_HASH);
  if (!user || !validPassword) throw new AppError("Invalid credentials", 401);
  if (user.status === "locked") throw new AppError("Account locked", 403);
  if (user.status && user.status !== "active") {
    throw new AppError("Your account is inactive. Contact admin.", 403);
  }
  const [accessToken, refreshToken] = await Promise.all([
    user.getJWT(),
    issueRefreshToken(user),
  ]);
  context = administrationAudit.createContext({ ...audit, actorId: user._id,
    actorRole: user.role, branchId: user.branchId, correlationId: context.correlationId });
  await administrationAudit.authentication({ action: AUDIT_ACTIONS.AUTH_LOGIN,
    context, userId: user._id, statusAfter: "authenticated" });
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
  } catch (error) {
    try {
      if (user) context = administrationAudit.createContext({ ...audit,
        actorId: user._id, actorRole: user.role, branchId: user.branchId,
        correlationId: context.correlationId });
      await administrationAudit.failure({ action: AUDIT_ACTIONS.AUTH_LOGIN,
        context, entityId: user?._id ?? null, error });
    } catch (_auditFailure) {
      // A secondary audit outage must not replace the authentication error.
    }
    throw error;
  }
};

const refresh = async (refreshToken) => {
  if (!refreshToken) throw new AppError("No refresh token", 401);
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, {
      algorithms: REFRESH_TOKEN_ALGORITHMS,
    });
  } catch (err) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !payload._id ||
    (payload.tokenType
      ? payload.tokenType !== "refresh"
      : typeof payload.role === "string")
  ) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  const user = await userRepository.findByIdWithSelection(
    payload._id,
    "+refreshTokenHash",
  );
  if (!user) throw new AppError("User not found", 401);
  if (user.status !== "active") {
    if (typeof user.revokeRefreshToken === "function")
      await user.revokeRefreshToken();
    throw new AppError("Your account is inactive. Contact admin.", 403);
  }
  if (
    typeof user.matchesRefreshToken === "function" &&
    !user.matchesRefreshToken(refreshToken)
  ) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  const [accessToken, newRefreshToken] = await Promise.all([
    user.getJWT(),
    issueRefreshToken(user),
  ]);
  return { accessToken, refreshToken: newRefreshToken };
};

const logout = async (token, verifyAccessToken) => {
  let payload = null;
  const contextSeed = administrationAudit.createContext();
  try {
    if (token) {
      payload = verifyAccessToken(token);
      await userRepository.clearRefreshToken(payload._id);
    }
  } catch (err) {
    // Logout is intentionally idempotent for expired or invalid sessions.
  }
  const context = administrationAudit.createContext({
    actorId: payload?._id, actorRole: payload?.role, branchId: payload?.branchId,
    correlationId: contextSeed.correlationId,
  });
  try {
    await administrationAudit.authentication({ action: AUDIT_ACTIONS.AUTH_LOGOUT,
      context, userId: payload?._id ?? null, statusBefore: "authenticated",
      statusAfter: "logged_out" });
  } catch (error) {
    try {
      await administrationAudit.failure({ action: AUDIT_ACTIONS.AUTH_LOGOUT,
        context, entityId: payload?._id ?? null, error });
    } catch (_auditFailure) {
      // A secondary audit outage must not replace the audit write error.
    }
    throw error;
  }
};

module.exports = { signup, login, refresh, logout };
