const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect(
    "mongodb+srv://pandikumardev4_db_user:qOWrQvbvPfWWhaAk@kot-pos.tzlrl6o.mongodb.net/Kot-Pos"
  );
};
module.exports = { connectDB };
