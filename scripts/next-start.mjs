import { spawnSync } from "node:child_process";

const host = process.env.NEXT_HOST || process.env.HOST || "0.0.0.0";
const port = process.env.PORT || "3000";

const result = spawnSync("next", ["start", "--hostname", host, "--port", port], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-build" }
});

process.exit(result.status ?? 1);
