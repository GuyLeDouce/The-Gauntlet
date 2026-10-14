const { readdirSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");

const root = join(__dirname, "..");
const ignoredDirs = new Set([".git", "node_modules"]);

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirs.has(entry.name)) return [];
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const file of jsFiles(root)) {
  run(process.execPath, ["--check", file]);
}

run(process.execPath, [join(__dirname, "online-reward-webhook-check.js")]);

run(process.execPath, [join(__dirname, "survival-control-check.js")]);

// Verify Squigwreck media delivery without a live Discord channel or web access.
run(process.execPath, ["--test",
  join(__dirname, "../tests/deathRaceScenarios.test.js"),
  join(__dirname, "../tests/squigwreckMedia.test.js"),
  join(__dirname, "../tests/squigwreckConfig.test.js"),
  join(__dirname, "../tests/squigwreckPresentation.test.js"),
  join(__dirname, "../tests/survivalArtCredit.test.js"),
]);

console.log("Gauntlet bot check passed.");
