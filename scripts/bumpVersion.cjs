const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const versionFile = path.resolve(__dirname, "../src/config/version.ts");

function getCommitMessage() {
  try {
    // Try to get the message of the last commit
    return execSync("git log -1 --pretty=%B", { stdio: 'pipe' }).toString().trim();
  } catch {
    // Fallback for CI or environments without git
    return process.env.GITHUB_EVENT_PATH ? "ci: triggered by github action" : "manual: version bump";
  }
}

function bumpVersion(version, message) {
  const [major, minor, patch] = version.split(".").map(Number);
  
  if (message.includes("break:") || message.includes("MAJOR:")) {
    return `${major + 1}.0.0`;
  } else if (message.includes("feat:") || message.includes("MINOR:")) {
    return `${major}.${minor + 1}.0`;
  } else {
    // Default to patch bump
    return `${major}.${minor}.${patch + 1}`;
  }
}

function updateVersion() {
  if (!fs.existsSync(versionFile)) {
    console.error("Version file not found at:", versionFile);
    process.exit(1);
  }

  const content = fs.readFileSync(versionFile, "utf-8");
  const match = content.match(/"(\d+\.\d+\.\d+)"/);
  
  if (!match) {
    console.error("Version string not found in file content");
    process.exit(1);
  }

  const currentVersion = match[1];
  const message = getCommitMessage();
  const newVersion = bumpVersion(currentVersion, message);

  const updated = content.replace(currentVersion, newVersion);
  fs.writeFileSync(versionFile, updated);

  console.log(`Version bumped: ${currentVersion} → ${newVersion} (based on message: "${message.split('\n')[0]}")`);
}

updateVersion();
