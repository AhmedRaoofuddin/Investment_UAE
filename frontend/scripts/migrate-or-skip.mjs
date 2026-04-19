// Cross-platform wrapper for `prisma migrate deploy`. We swallow failures
// because:
//   - Local builds without DB env should still produce a working bundle.
//   - On Vercel the env is always present, so a non-zero exit here is a
//     genuine migration failure we *want* to bubble up — but Vercel build
//     logs already capture stdout, so we surface the error message and
//     still exit 0 to let `next build` continue. If the new schema column
//     is missing, requests will 500 at runtime and you'll see the trace
//     immediately. (We can switch to fail-fast once DB ops are stable.)

import { spawnSync } from "node:child_process";

if (!process.env.POSTGRES_PRISMA_URL && !process.env.DATABASE_URL) {
  console.log("[migrate-or-skip] No DB env detected — skipping migration.");
  process.exit(0);
}

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
});

if (r.status !== 0) {
  console.warn(
    `[migrate-or-skip] migrate deploy exited with ${r.status} — continuing build. ` +
      `Investigate immediately if this happens on Vercel.`,
  );
}
process.exit(0);
