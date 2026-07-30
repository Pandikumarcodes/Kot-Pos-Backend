const DEFAULT_OPTIONS = {
  abortEarly: false,
  allowUnknown: true,
  convert: true,
};

const setValidatedValue = (req, source, value) => {
  if (source === "query") {
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, value);
  } else {
    req[source] = value;
  }
};

const validateRequest = (schemas, options = {}) => (req, res, next) => {
  for (const source of ["params", "query", "body"]) {
    if (!schemas[source]) continue;
    const { error, value } = schemas[source].validate(req[source] ?? {}, {
      ...DEFAULT_OPTIONS,
      ...options,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join("."),
        location: source,
        message: detail.message.replace(/"/g, ""),
        type: detail.type,
      }));
      return res.status(400).json({
        error: validationErrors[0].message,
        validationErrors,
      });
    }
    setValidatedValue(req, source, value);
  }
  return next();
};

module.exports = { validateRequest };
