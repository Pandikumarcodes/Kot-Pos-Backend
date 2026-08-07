const mongoose = require("mongoose");

// Unit tests must fail immediately when a model method was not mocked; waiting
// for Mongoose's ten-second buffering timeout hides the actual test defect.
if (process.env.NODE_ENV === "test") {
  mongoose.set("bufferCommands", false);
  mongoose.set("bufferTimeoutMS", 0);
}
