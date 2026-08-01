const BaseRepository = require("./BaseRepository");
const User = require("../models/users");

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  findByUsername(username, selection) {
    const query = this.findOne({ username });
    return selection && query && typeof query.select === "function"
      ? query.select(selection)
      : query;
  }

  findByIdWithSelection(id, selection) {
    const query = this.findById(id);
    return selection && query && typeof query.select === "function"
      ? query.select(selection)
      : query;
  }

  createUserDocument(data) {
    return this.createDocument(data);
  }

  findByScope(filter) {
    return this.findMany(filter).select("-password");
  }

  updateRole(filter, role) {
    return this.model.findOneAndUpdate(
      filter,
      { role },
      { new: true, runValidators: true, select: "-password" },
    );
  }

  deleteByScope(filter) {
    return this.model.findOneAndDelete(filter);
  }

  clearRefreshToken(userId) {
    return this.updateOne(
      { _id: userId },
      { $set: { refreshTokenHash: null } },
    );
  }
}

module.exports = new UserRepository();
module.exports.UserRepository = UserRepository;
