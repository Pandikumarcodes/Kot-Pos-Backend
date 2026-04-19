const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

// ── Mock models ───────────────────────────────────────────────
jest.mock("../../models/users");

// ── Mock logger ───────────────────────────────────────────────
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Mock validation ───────────────────────────────────────────
jest.mock("../../utils/validation", () => ({
  validateSignupData: jest.fn(),
  validateRole: jest.fn(({ role }) => role || "waiter"),
  validateStatus: jest.fn(({ status }) => status || "active"),
}));

const User = require("../../models/users");
const { validateSignupData } = require("../../utils/validation");
const { adminUserRouter } = require("../../routes/admin/adminUser");

// ── Build minimal Express app ─────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin", adminUserRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeToken(role = "admin") {
  return jwt.sign(
    { _id: "user_id_123", username: "testuser", role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    username: "testuser",
    role: "waiter",
    status: "active",
    branchId: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const VALID_USER_ID = new mongoose.Types.ObjectId().toString();

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/create-user
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/create-user", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 — admin can create a new user", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findOne.mockResolvedValue(null); // username not taken
    const newUser = mockUserDoc({ username: "newstaff", role: "waiter" });
    User.mockImplementation(() => newUser);

    const res = await request(app)
      .post("/api/v1/admin/create-user")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ username: "newstaff", password: "Test@1234!", role: "waiter" });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("New user created successfully");
    expect(res.body.user).toMatchObject({
      username: "newstaff",
      role: "waiter",
    });
  });

  it("400 — rejects duplicate username", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findOne.mockResolvedValue(mockUserDoc()); // already exists

    const res = await request(app)
      .post("/api/v1/admin/create-user")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ username: "testuser", password: "Test@1234!", role: "waiter" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("username already exists");
  });

  it("400 — rejects when validateSignupData throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    validateSignupData.mockImplementationOnce(() => {
      throw new Error("Username and password are required");
    });

    const res = await request(app)
      .post("/api/v1/admin/create-user")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Username and password are required");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/create-user")
      .send({ username: "newstaff", password: "Test@1234!" });

    expect(res.status).toBe(401);
  });

  it("403 — manager cannot create a user (admin only)", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "manager" }));

    const res = await request(app)
      .post("/api/v1/admin/create-user")
      .set("Cookie", `token=${makeToken("manager")}`)
      .send({ username: "newstaff", password: "Test@1234!", role: "waiter" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — waiter cannot create a user", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "waiter" }));

    const res = await request(app)
      .post("/api/v1/admin/create-user")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ username: "newstaff", password: "Test@1234!" });

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot create a user", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "cashier" }));

    const res = await request(app)
      .post("/api/v1/admin/create-user")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ username: "newstaff", password: "Test@1234!" });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/users
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/users", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch all users", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.find.mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue([
          mockUserDoc({ username: "staff1" }),
          mockUserDoc({ username: "staff2" }),
        ]),
    });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
  });

  it("200 — manager can fetch all users", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "manager" }));
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([mockUserDoc()]),
    });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
  });

  it("404 — returns 404 when no users found", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("No users found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/users");
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot fetch users", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "waiter" }));

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot fetch users", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "chef" }));

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot fetch users", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "cashier" }));

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.find.mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error("DB error")),
    });

    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch users");
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/admin/update-role/:userId
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/admin/update-role/:userId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can update a user role", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findByIdAndUpdate.mockResolvedValue(
      mockUserDoc({ _id: VALID_USER_ID, username: "staff1", role: "chef" }),
    );

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ role: "chef" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User role updated successfully");
    expect(res.body.user.newRole).toBe("chef");
  });

  it("200 — manager can update a user role", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "manager" }));
    User.findByIdAndUpdate.mockResolvedValue(
      mockUserDoc({ _id: VALID_USER_ID, role: "cashier" }),
    );

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`)
      .send({ role: "cashier" });

    expect(res.status).toBe(200);
  });

  it("400 — rejects missing role field", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Role is required");
  });

  it("400 — rejects invalid role value", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ role: "superuser" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid role");
  });

  it("400 — rejects invalid userId format", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));

    const res = await request(app)
      .put("/api/v1/admin/update-role/invalid_id")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ role: "waiter" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid userId");
  });

  it("404 — returns 404 when user does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ role: "waiter" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .send({ role: "waiter" });

    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot update roles", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "waiter" }));

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send({ role: "chef" });

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot update roles", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "cashier" }));

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ role: "chef" });

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findByIdAndUpdate.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .put(`/api/v1/admin/update-role/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`)
      .send({ role: "waiter" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to update user role");
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/deleteUser/:userId
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/v1/admin/deleteUser/:userId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can delete a user", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findByIdAndDelete.mockResolvedValue(
      mockUserDoc({ _id: VALID_USER_ID, username: "staff1" }),
    );

    const res = await request(app)
      .delete(`/api/v1/admin/deleteUser/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User deleted successfully");
    expect(res.body.user.username).toBe("staff1");
  });

  it("400 — rejects invalid userId format", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));

    const res = await request(app)
      .delete("/api/v1/admin/deleteUser/invalid_id")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid User Id");
  });

  it("404 — returns 404 when user does not exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findByIdAndDelete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/v1/admin/deleteUser/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).delete(
      `/api/v1/admin/deleteUser/${VALID_USER_ID}`,
    );
    expect(res.status).toBe(401);
  });

  it("403 — manager cannot delete a user (admin only)", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "manager" }));

    const res = await request(app)
      .delete(`/api/v1/admin/deleteUser/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — waiter cannot delete a user", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "waiter" }));

    const res = await request(app)
      .delete(`/api/v1/admin/deleteUser/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
  });

  it("403 — chef cannot delete a user", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "chef" }));

    const res = await request(app)
      .delete(`/api/v1/admin/deleteUser/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("chef")}`);

    expect(res.status).toBe(403);
  });

  it("403 — cashier cannot delete a user", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "cashier" }));

    const res = await request(app)
      .delete(`/api/v1/admin/deleteUser/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });

  it("500 — returns 500 when DB throws", async () => {
    User.findById.mockResolvedValue(mockUserDoc({ role: "admin" }));
    User.findByIdAndDelete.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .delete(`/api/v1/admin/deleteUser/${VALID_USER_ID}`)
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(500);
  });
});
