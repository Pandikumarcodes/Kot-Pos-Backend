// ── Manual MongoDB Sanitizer ──────────────────────────────────
// Replaces express-mongo-sanitize which crashes on newer Express/router
// versions because req.query is a read-only getter.
//
// What this does:
// - Removes keys starting with $ (e.g. { $where: "..." }) → NoSQL injection
// - Removes keys containing .  (e.g. { "a.b": "..." }) → dot notation attack
// - Recursively sanitizes nested objects and arrays
// - Only touches req.body and req.params — never req.query (read-only)

const sanitizeValue = (value) => {
  if (typeof value === "string") {
    return value.replace(/[\$]/g, "_"); // strip $ from string values
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    return sanitizeObject(value);
  }
  return value;
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  return Object.keys(obj).reduce((acc, key) => {
    // strip keys that start with $ or contain . (NoSQL injection vectors)
    const safeKey = key.replace(/^\$+/, "_").replace(/\./g, "_");
    acc[safeKey] = sanitizeValue(obj[key]);
    return acc;
  }, {});
};

const mongoSanitize = (req, res, next) => {
  // ✅ sanitize body — where user data comes in
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  // ✅ sanitize params — e.g. /admin/user/:id
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }

  // ❌ never touch req.query — read-only getter in newer Express/router
  // query params don't reach MongoDB directly anyway in your routes

  next();
};

module.exports = mongoSanitize;
