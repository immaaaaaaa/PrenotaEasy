import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
const publicRoot = resolve(root, "public");

// A local next start can accidentally use files absent from a serverless bundle.
// Load each compiled layout from an isolated working directory containing only
// the public assets listed in that route's actual production file trace.
for (const route of ["login", "dashboard", "dashboard/settings", "master", "prenota/[slug]"]) {
  test(`/${route} loads with its traced runtime assets`, () => {
    const entry = resolve(root, ".next/server/app", route, "page.js");
    const trace = `${entry}.nft.json`;
    const files = JSON.parse(readFileSync(trace, "utf8")).files;
    const runtime = mkdtempSync(join(tmpdir(), "prenotaeasy-runtime-"));

    try {
      for (const file of files) {
        const source = resolve(dirname(trace), file);
        if (!source.startsWith(`${publicRoot}${sep}`)) continue;
        const destination = join(runtime, relative(root, source));
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(source, destination);
      }

      const script = `(async () => {
        try {
          const page = require(${JSON.stringify(entry)});
          await page.routeModule.userland.loaderTree[2].layout[0]();
        } catch (error) {
          console.error(error.code + ': ' + error.message);
          process.exitCode = 1;
        }
      })();`;
      const result = spawnSync(process.execPath, ["-e", script], {
        cwd: runtime,
        encoding: "utf8",
        env: { NODE_ENV: "production" },
        timeout: 15000,
      });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
    } finally {
      rmSync(runtime, { recursive: true, force: true });
    }
  });
}
