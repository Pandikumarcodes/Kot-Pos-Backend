// const { doubleCsrf } = require("csrf-csrf");

// const isProduction = process.env.NODE_ENV === "production";

// const { generateToken, doubleCsrfProtection } = doubleCsrf({
//   getSecret: () => process.env.CSRF_SECRET,
//   cookieName: isProduction ? "__Host-psifi.x-csrf-token" : "x-csrf-token",
//   cookieOptions: {
//     httpOnly: true,
//     secure: isProduction,
//     sameSite: isProduction ? "none" : "lax",
//   },
//   size: 64,
//   getTokenFromRequest: (req) => req.headers["x-csrf-token"] || req.body?._csrf,
// });

// module.exports = { generateToken, doubleCsrfProtection };
