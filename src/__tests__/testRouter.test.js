const express = require("express");
const request = require("supertest");
const { mountTestRoutes } = require("../routes/testRouter");

const buildApp = (environment) => {
  const app = express();
  mountTestRoutes(app, environment);
  return app;
};

describe("development test routes", () => {
  it("are available in development", async () => {
    const response = await request(buildApp("development")).get("/api/v1/test/ping");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, environment: "development" });
  });

  it("are unavailable in production", async () => {
    const response = await request(buildApp("production")).get("/api/v1/test/ping");

    expect(response.status).toBe(404);
  });
});
