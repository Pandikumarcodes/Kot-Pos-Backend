const jwt = require("jsonwebtoken");
const User = require("../models/users");
const secretKey = "Pandi";

const userAuth = async (req, res, next) => {
  try {
    const cookies = req.cookies;
    const token = cookies.token;
    if (!token) {
      throw new Error("Token is missing");
    }
    const decodedObj = jwt.verify(token, secretKey);
    const { _id } = decodedObj;
    const user = await User.findById(_id);
    if (!user) {
      throw new Error("User not found");
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).send("error: " + err.message);
  }
};

module.exports = {
  userAuth,
};
