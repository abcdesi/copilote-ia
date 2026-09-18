import { spawnSync } from "node:child_process";

const ALLOWED_VULNERABILITY_NAMES = new Set(["deepmerge-ts", "@prisma/config", "prisma"]);
const ALLOWED_ADVISORY = "https://github.com/advisories/GHSA-ggr8-5vv4-36mx";

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (!result.stdout) {
  console.error("npm audit did not return a JSON report.");
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  console.error("Unable to parse npm audit JSON.", error);
  console.error(result.stdout);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const names = Object.keys(vulnerabilities);
if (names.length === 0) {
  console.log("Production dependency audit: OK");
  process.exit(0);
}

const unexpectedNames = names.filter((name) => !ALLOWED_VULNERABILITY_NAMES.has(name));
const advisoryUrls = new Set();

for (const vulnerability of Object.values(vulnerabilities)) {
  for (const via of vulnerability?.via ?? []) {
    if (via && typeof via === "object" && typeof via.url === "string") {
      advisoryUrls.add(via.url);
    }
  }
}

const unexpectedAdvisories = [...advisoryUrls].filter((url) => url !== ALLOWED_ADVISORY);

if (unexpectedNames.length > 0 || unexpectedAdvisories.length > 0 || !advisoryUrls.has(ALLOWED_ADVISORY)) {
  console.error("Production dependency audit found non-waived vulnerabilities.");
  console.error(JSON.stringify(report.metadata?.vulnerabilities ?? {}, null, 2));
  console.error("Packages:", names.join(", "));
  console.error("Advisories:", [...advisoryUrls].join(", "));
  process.exit(1);
}

console.warn(
  "Temporary security waiver: GHSA-ggr8-5vv4-36mx reaches Pilotzia only through Prisma's config/CLI dependency chain. " +
    "The advisory is tracked upstream; remove this waiver as soon as Prisma ships deepmerge-ts >= 8."
);
console.log("Production dependency audit: OK with one documented Prisma CLI waiver.");
