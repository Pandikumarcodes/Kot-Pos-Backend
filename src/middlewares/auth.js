const jwt = require("jsonwebtoken");
const User = require("../models/users");
const {
  unauthorized,
  forbidden,
} = require("../utils/apiResponse");

const ACCESS_TOKEN_ALGORITHMS = ["HS256"];

const AUTH_ERRORS = Object.freeze({
  MISSING_TOKEN: "Not authenticated",
  INVALID_TOKEN: "Invalid or expired token",
  USER_NOT_FOUND: "User not found",
  INACTIVE_USER: "Account inactive",
  FORBIDDEN: "Forbidden - insufficient role",
});

class AuthenticationError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.status = status;
  }
}

const getAccessToken = (req) => {
  const cookieToken = req.cookies?.token;
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }

  const authorization = req.get?.("Authorization");
  if (typeof authorization !== "string") {
    return null;
  }

  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  return match ? match[1] : null;
};

const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ACCESS_TOKEN_ALGORITHMS,
  });

  if (
    !payload ||
    typeof payload !== "object" ||
    !payload._id ||
    (payload.tokenType
      ? payload.tokenType !== "access"
      : typeof payload.role !== "string")
  ) {
    throw new AuthenticationError(AUTH_ERRORS.INVALID_TOKEN);
  }

  return payload;
};

const authenticateRequest = async (req) => {
  const token = getAccessToken(req);
  if (!token) {
    throw new AuthenticationError(AUTH_ERRORS.MISSING_TOKEN);
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      throw err;
    }
    throw new AuthenticationError(AUTH_ERRORS.INVALID_TOKEN);
  }

  const user = await User.findById(payload._id);
  if (!user) {
    throw new AuthenticationError(AUTH_ERRORS.USER_NOT_FOUND);
  }

  // Mongoose applies the schema's active default to legacy records that do not
  // yet persist a status value; every explicit non-active status is rejected.
  if (user.status && user.status !== "active") {
    throw new AuthenticationError(AUTH_ERRORS.INACTIVE_USER, 403);
  }

  return user;
};

const userAuth = async (req, res, next) => {
  try {
    req.user = await authenticateRequest(req);
    next();
  } catch (err) {
    const status = err instanceof AuthenticationError ? err.status : 401;
    const error =
      err instanceof AuthenticationError
        ? err.message
        : AUTH_ERRORS.INVALID_TOKEN;
    return status === 403
      ? forbidden(res, error)
      : unauthorized(res, error);
  }
};

const allowRoles = (roles = []) => {
  const allowedRoles = new Set(roles);

  return (req, res, next) => {
    if (!req.user || !allowedRoles.has(req.user.role)) {
      return forbidden(res, AUTH_ERRORS.FORBIDDEN);
    }
    next();
  };
};

const requireRoles = allowRoles;

const authorize = (roles = []) => [userAuth, requireRoles(roles)];

module.exports = {
  userAuth,
  allowRoles,
  requireRoles,
  authorize,
  authenticateRequest,
  getAccessToken,
  verifyAccessToken,
  AuthenticationError,
  AUTH_ERRORS,
};
