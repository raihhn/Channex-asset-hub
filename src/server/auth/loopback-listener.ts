import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Pure parser, also used to test unsafe bindings without opening them. */
export function isOnlyLoopbackListing(stdout: string, port: number): boolean {
  const names = stdout
    .split("\n")
    .filter((line) => line.startsWith("n"))
    .map((line) => line.slice(1));
  return (
    names.length > 0 &&
    names.every((name) => /^(127\.0\.0\.1|\[::1\]):\d+$/.test(name)) &&
    names.some(
      (name) => name === `127.0.0.1:${port}` || name === `[::1]:${port}`,
    )
  );
}

/** Request URL/Host cannot attest socket ingress. Inspect this process's actual
 * listener; unsupported platforms, proxies and worker-only processes fail closed.
 * No shell, network connection, or configuration mutation is involved. */
export async function hasOnlyLoopbackListener(port: number): Promise<boolean> {
  try {
    const { stdout } = await run(
      "lsof",
      ["-nP", "-a", "-p", String(process.pid), "-iTCP", "-sTCP:LISTEN", "-Fn"],
      { timeout: 2000, maxBuffer: 64 * 1024 },
    );
    return isOnlyLoopbackListing(stdout, port);
  } catch {
    return false;
  }
}
