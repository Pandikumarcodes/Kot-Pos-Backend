const { QueryValidationError, validateSearch } = require("./validation");

const SEARCH_MODES = Object.freeze(["partial", "prefix", "exact"]);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSearchField = (definition) => {
  const normalized =
    typeof definition === "string"
      ? { field: definition, mode: "partial" }
      : { mode: "partial", ...definition };
  if (!normalized.field || !SEARCH_MODES.includes(normalized.mode)) {
    throw new QueryValidationError("search field policy is invalid", "search");
  }
  return normalized;
};

const buildSearchFilter = (value, searchableFields = [], maxLength) => {
  const search = validateSearch(value, maxLength);
  if (!search) return null;
  if (!Array.isArray(searchableFields) || searchableFields.length === 0) {
    throw new QueryValidationError("search is not supported", "search");
  }
  const escaped = escapeRegex(search);
  const clauses = searchableFields.map((definition) => {
    const { field, mode } = normalizeSearchField(definition);
    const pattern =
      mode === "exact" ? `^${escaped}$` : mode === "prefix" ? `^${escaped}` : escaped;
    return { [field]: { $regex: pattern, $options: "i" } };
  });
  return { $or: clauses };
};

module.exports = { SEARCH_MODES, buildSearchFilter, escapeRegex };
