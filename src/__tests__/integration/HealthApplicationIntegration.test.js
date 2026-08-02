const request = require("supertest");
const mongoose = require("mongoose");

process.env.MONGO_URI ||= "mongodb://localhost:27017/kot-pos-test";
process.env.JWT_SECRET ||= "a".repeat(32);
process.env.REFRESH_TOKEN_SECRET ||= "b".repeat(32);
process.env.PORT ||= "3000";
process.env.NODE_ENV ||= "test";

const { app, lifecycle, io } = require("../../app");
const { STATES } = require("../../infrastructure/health/lifecycleState");

describe("health application integration", () => {
  afterAll(() => {
    mongoose.connection.readyState = 0;
  });

  test("GET /health is available before startup and does not require MongoDB", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "healthy",
      version: "v1",
      state: STATES.STARTING,
      lifecycleState: STATES.STARTING,
    });
    expect(typeof response.body.uptime).toBe("number");
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  test("GET /ready returns 503 before startup is complete", async () => {
    const response = await request(app).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("unhealthy");
    expect(response.body.checks.startup.status).toBe("unhealthy");
  });

  test("GET /ready returns 200 after lifecycle, MongoDB, and Socket.IO are ready", async () => {
    mongoose.connection.readyState = 1;
    lifecycle.transition(STATES.READY);

    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "healthy",
      checks: {
        lifecycle: { status: "healthy", state: STATES.READY },
        startup: { status: "healthy" },
        mongo: { status: "healthy" },
        socket: { status: "healthy" },
      },
    });
    expect(io).toBeDefined();
  });

  test("GET /ready returns 503 when MongoDB becomes unavailable", async () => {
    mongoose.connection.readyState = 0;

    const response = await request(app).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body.checks.mongo).toEqual({ status: "unhealthy", reason: "connection state is 0" });
  });

  test("existing version route remains unchanged", async () => {
    const response = await request(app).get("/api/version");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      current: "v1",
      supported: ["v1"],
      deprecated: [],
      note: "All routes available under /api/v1/* prefix",
    });
  });

  test("liveness remains 200 while readiness is 503 during draining", async () => {
    mongoose.connection.readyState = 1;
    if (lifecycle.getState() !== STATES.READY) return;
    lifecycle.transition(STATES.DRAINING);

    const [health, ready] = await Promise.all([
      request(app).get("/health"),
      request(app).get("/ready"),
    ]);

    expect(health.status).toBe(200);
    expect(health.body.lifecycleState).toBe(STATES.DRAINING);
    expect(ready.status).toBe(503);
    expect(ready.body.checks.lifecycle).toMatchObject({ status: "unhealthy", state: STATES.DRAINING });
  });
});
