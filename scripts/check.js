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

console.log("Gauntlet bot check passed.");
