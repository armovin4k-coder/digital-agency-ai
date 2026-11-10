import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const isProductionDeployment = process.env.VERCEL_ENV === "production";

function runPrisma(args) {
  const result = spawnSync(
    process.execPath,
    [resolve("node_modules/prisma/build/index.js"), ...args],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runNextBuild() {
  const result = spawnSync(
    process.execPath,
    [resolve("node_modules/next/dist/bin/next"), "build"],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isProductionDeployment) {
  runPrisma(["migrate", "deploy"]);
  if (process.env.SEED_ISOLATED_DEMO_DATABASE === "true") {
    runPrisma(["db", "seed"]);
  }
}

runNextBuild();
