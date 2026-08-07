const fs = require("fs");
const path = require("path");

const parseArgs = (argv = process.argv.slice(2)) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) result[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith("--"))
      result[key] = argv[++index];
    else result[key] = true;
  }
  return result;
};

const atomicWriteJson = (file, value) => {
  const absolute = path.resolve(file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporary, absolute);
};

const readJson = (file, fallback = null) => {
  if (!file || !fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

const summarize = (decisions) =>
  decisions.reduce(
    (summary, decision) => {
      summary.total += 1;
      summary[decision.decision] = (summary[decision.decision] || 0) + 1;
      return summary;
    },
    { total: 0 },
  );

module.exports = { parseArgs, atomicWriteJson, readJson, summarize };
