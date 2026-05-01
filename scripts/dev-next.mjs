import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const lockPath = join(root, ".next-dev.lock");
const nextDir = join(root, ".next");
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);

function isAlive(pid) {
  if (!pid || pid === process.pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLock() {
  try {
    return JSON.parse(await readFile(lockPath, "utf8"));
  } catch {
    return null;
  }
}

async function removeLock() {
  await rm(lockPath, { force: true });
}

async function main() {
  if (!existsSync(nextBin)) {
    throw new Error("Next.js is not installed. Run bun install first.");
  }

  const existing = await readLock();
  if (existing?.pid && isAlive(existing.pid)) {
    console.error(
      [
        `Another Next dev server for this checkout is already running (PID ${existing.pid}).`,
        "Stop it before starting a second one, otherwise both processes write to .next and cause missing chunks/404s.",
      ].join("\n"),
    );
    process.exit(1);
  }

  await removeLock();
  await rm(nextDir, { recursive: true, force: true });
  await writeFile(
    lockPath,
    JSON.stringify(
      {
        pid: process.pid,
        command: ["next", "dev", ...args].join(" "),
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const child = spawn(process.execPath, [nextBin, "dev", ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  const cleanup = async () => {
    await removeLock();
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("exit", async (code, signal) => {
    await cleanup();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch(async (error) => {
  await removeLock();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
