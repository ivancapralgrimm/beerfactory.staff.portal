import { spawn } from "node:child_process";
import fs from "node:fs";
const servers = [];
fs.mkdirSync("reports", { recursive: true });
async function run(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
async function start(port, source) {
  const stream = fs.openSync(`reports/vite-${source}.log`, "w");
  const child = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      ...(source === "supabase" && process.env.BF_TEST_PREVIEW_DIST
        ? ["preview", "--outDir", process.env.BF_TEST_PREVIEW_DIST]
        : []),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      stdio: ["ignore", stream, stream],
      env: {
        ...process.env,
        VITE_SUPABASE_URL: "http://127.0.0.1:54329",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only",
        VITE_RECIPE_API_BASE: "http://127.0.0.1:54329/recipes",
        VITE_KNOWLEDGE_SOURCE: source,
      },
    },
  );
  servers.push(child);
  fs.closeSync(stream);
  let ready = false;
  for (let count = 0; count < 100; count++) {
    if (child.exitCode !== null)
      throw new Error(
        `Test server ${source} exited; see reports/vite-${source}.log`,
      );
    try {
      ready = (await fetch(`http://127.0.0.1:${port}`)).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Test server ${source} did not start`);
  if (process.env.BF_TEST_AGENT_BROWSER) {
    const cli = process.env.BF_TEST_AGENT_BROWSER;
    const env = {
      AGENT_BROWSER_SOCKET_DIR: "/tmp/bfstaff-agent-sockets",
      AGENT_BROWSER_EXECUTABLE_PATH:
        process.env.BF_TEST_CHROMIUM || "/usr/bin/chromium",
      AGENT_BROWSER_ARGS: "--no-sandbox",
    };
    await run(cli, ["open", `http://127.0.0.1:${port}`], env);
    await run(cli, ["wait", "--load", "networkidle"], env);
    await run(cli, ["screenshot", `reports/${source}-server-login.png`], env);
    await run(cli, ["snapshot", "-i"], env);
    await run(cli, ["errors"], env);
    await run(
      cli,
      [
        "eval",
        'document.querySelector("vite-error-overlay") ? "ERROR_OVERLAY" : document.body.innerText.trim().length > 0 ? "HAS_CONTENT" : "BLANK"',
      ],
      env,
    );
    await run(cli, ["close"], env);
  }
}
try {
  if (process.env.BF_TEST_EXTERNAL_SERVERS !== "1") {
    await run(process.execPath, ["scripts/sync-public.mjs"]);
    await start(4175, "supabase");
    await start(4176, "legacy");
  }
  await run(process.execPath, ["tests/browser.mjs"]);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const child of servers) child.kill("SIGTERM");
}
