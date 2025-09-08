const validator = require("validator");

const validateSignupData = (req, res) => {
  console.log(req);
  const { username, password } = req.body;
  if (!username) {
    throw new Error("Username and password are required");
  } else if (!username) {
    throw new Error("Name is Not valid");
  } else if (!validator.isStrongPassword(password)) {
    throw new Error("Enter a strong password ");
  }
};

module.exports = {
  validateSignupData,
};
