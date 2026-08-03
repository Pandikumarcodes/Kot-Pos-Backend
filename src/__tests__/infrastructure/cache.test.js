const { CacheMetrics } = require("../../infrastructure/cache/cacheMetrics");
const { cacheKeys } = require("../../infrastructure/cache/cacheKeys");

describe("cache infrastructure", () => {
  test("builds branch-scoped, versioned keys without exposing raw separators", () => {
    expect(cacheKeys.settings({ branchId: "branch-1" })).toBe("kot-pos:v1:settings:branch-1");
    expect(cacheKeys.menu({ branchId: "branch-1", query: { page: 1 } }))
      .toBe("kot-pos:v1:menu:branch-1:%7B%22page%22%3A1%7D");
    expect(cacheKeys.settings()).toBe("kot-pos:v1:settings:global");
  });

  test("reports cache hit rate from lookup counters", () => {
    const metrics = new CacheMetrics();
    metrics.increment("hits");
    metrics.increment("misses");
    metrics.increment("errors");
    expect(metrics.snapshot()).toMatchObject({ hits: 1, misses: 1, errors: 1, hitRate: 0.5 });
  });

  test("cache bypasses cleanly when Redis is not configured", async () => {
    const { cache } = require("../../infrastructure/cache");
    await expect(cache.get("missing")).resolves.toBeUndefined();
    await expect(cache.getOrSet("missing", async () => "mongo-value")).resolves.toBe("mongo-value");
    expect(cache.metrics().configured).toBe(false);
  });
});
