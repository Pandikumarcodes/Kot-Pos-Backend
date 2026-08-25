const USER_RESPONSE_FIELDS = Object.freeze([
  "id",
  "username",
  "role",
  "status",
  "branchId",
]);

const USER_RESPONSE_PROJECTION = Object.freeze({
  _id: 1,
  username: 1,
  role: 1,
  status: 1,
  branchId: 1,
});

const read = (user, field) =>
  typeof user?.get === "function" ? user.get(field) : user?.[field];

const toUserResponse = (user) => {
  if (user == null) return null;

  const values = {
    id: read(user, "_id") ?? read(user, "id"),
    username: read(user, "username"),
    role: read(user, "role"),
    status: read(user, "status"),
    branchId: read(user, "branchId"),
  };

  return Object.fromEntries(
    USER_RESPONSE_FIELDS
      .filter((field) => values[field] !== undefined)
      .map((field) => [field, values[field]]),
  );
};

module.exports = {
  USER_RESPONSE_FIELDS,
  USER_RESPONSE_PROJECTION,
  toUserResponse,
};
