class CacheMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.counters = { hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0, bypasses: 0 };
  }

  increment(name) {
    if (Object.prototype.hasOwnProperty.call(this.counters, name)) this.counters[name] += 1;
  }

  snapshot() {
    const totalLookups = this.counters.hits + this.counters.misses;
    return {
      ...this.counters,
      hitRate: totalLookups ? Number((this.counters.hits / totalLookups).toFixed(4)) : 0,
    };
  }
}

module.exports = { CacheMetrics };
