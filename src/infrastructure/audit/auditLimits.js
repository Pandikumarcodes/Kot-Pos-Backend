const AUDIT_LIMITS = Object.freeze({
  maxEventBytes: 16 * 1024,
  targetEventBytes: 2 * 1024,
  maxChanges: 50,
  maxAffectedEntityIds: 100,
  maxStringLength: 512,
  maxFreeTextLength: 1024,
  maxArrayLength: 100,
  maxObjectKeys: 100,
  maxDepth: 6,
  maxBatchSize: 100,
});

module.exports = AUDIT_LIMITS;
