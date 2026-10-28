// Playwright global setup that attaches the test run to the Playwright Server container shared by all
// test runs on this machine that use the same Playwright version, starting the container if needed.
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import module from "node:module";
import net from "node:net";
import path from "node:path";
import timers from "node:timers/promises";
import util from "node:util";

export const PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME = "PLAYWRIGHT_SERVER_PORT";
const PLAYWRIGHT_SERVER_VERSION_LABEL = "patricktree-stack.playwright-server.version";
// The first run on a machine builds the server image, which pulls the Playwright base image and
// installs Playwright from npm.
const IMAGE_BUILD_TIMEOUT_MS = 300_000;
// Starting a container and connecting takes about two seconds; the margin covers a busy machine.
const STARTUP_TIMEOUT_MS = 30_000;
// Bounds each Docker call other than the image build, so an unresponsive Docker daemon cannot block the run.
const DOCKER_COMMAND_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 500;
const PROBE_TIMEOUT_MS = 2000;
const IMAGE_DIRECTORY = path.join(import.meta.dirname, "playwright-server-image");
const IMAGE_FILE_NAMES = ["Dockerfile", "serve.sh"];
// Must match the activity marker in `serve.sh`, whose idle timer this file resets.
const ACTIVITY_MARKER_PATH = "/tmp/last-used";
// Well below the 10-minute idle timeout in `serve.sh`, so a missed heartbeat or two does not matter.
const HEARTBEAT_INTERVAL_MS = 60_000;

const execFile = util.promisify(childProcess.execFile);

/** Playwright runs the returned function as global teardown. */
export default async function globalSetup(): Promise<() => void> {
  const { containerName, port } = await ensurePlaywrightServer();

  // Workers inherit the environment of the runner process and read the port in the shared configuration.
  // oxlint-disable-next-line node/no-process-env -- Passes the port from global setup to the workers.
  process.env[PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME] = String(port);

  // UI and watch mode run global setup once and keep the runner process alive between test runs, so
  // the runner keeps the container from stopping while no worker is connected. When the runner exits
  // or crashes, the heartbeat stops and the container's idle timeout takes over.
  const heartbeat = setInterval(() => {
    // A failed heartbeat needs no handling: the next one, or the idle timeout, settles it.
    markContainerAsUsed(containerName).catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);
  // Never keeps a finished run from exiting.
  heartbeat.unref();

  return () => {
    clearInterval(heartbeat);
  };
}

async function ensurePlaywrightServer(): Promise<{ containerName: string; port: number }> {
  const playwrightVersion = readInstalledPlaywrightVersion();
  // The image files hash is part of both names, so changing the image files never attaches a run to
  // a container of the previous image.
  const imageVersion = `v${playwrightVersion}-${hashImageFiles()}`;
  const image = `patricktree-stack/playwright-server:${imageVersion}`;
  // Docker rejects a second container with the same name, so the name is the lock that keeps
  // concurrently starting test runs from creating more than one container per version.
  const containerName = `patricktree-stack-playwright-server-${imageVersion}`;

  await ensureImage(image, playwrightVersion);

  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await startContainer({ containerName, image, playwrightVersion });

      // The container may be stopping because it was idle; the next iteration then starts a new one.
      const port = await readListeningPort(containerName);
      if (port !== undefined) {
        await markContainerAsUsed(containerName);

        if (await canConnect(port)) {
          if (await isPlaywrightServer(port)) {
            return { containerName, port };
          }

          // On Docker Desktop, host networking puts the server's port in the Linux VM. When a process
          // on the host already listens on the same port (macOS rapportd, for example), connections to
          // 127.0.0.1 reach that process instead, so no test run on this machine can use the
          // container. Removing it makes the next iteration start one on a new port.
          await runDocker(["rm", "--force", containerName]);
        }
      }
    } catch (error) {
      lastError = error;
    }

    await timers.setTimeout(RETRY_DELAY_MS);
  }

  throw new Error(
    `Playwright Server container "${containerName}" did not become ready within ${STARTUP_TIMEOUT_MS} ms. Inspect it with \`docker logs ${containerName}\`.`,
    { cause: lastError },
  );
}

async function ensureImage(image: string, playwrightVersion: string): Promise<void> {
  try {
    await runDocker(["image", "inspect", image]);
    return;
  } catch {
    // The image does not exist yet, or Docker is unavailable, which the build below reports.
  }

  // Concurrent first runs may each build the image; the builds are identical, so either result serves.
  try {
    await runDocker(
      [
        "build",
        "--quiet",
        "--build-arg",
        `PLAYWRIGHT_VERSION=${playwrightVersion}`,
        "--tag",
        image,
        IMAGE_DIRECTORY,
      ],
      IMAGE_BUILD_TIMEOUT_MS,
    );
  } catch (error) {
    throw new Error(
      `Could not build the Playwright Server image "${image}". Docker must be installed and running.`,
      { cause: error },
    );
  }
}

async function startContainer({
  containerName,
  image,
  playwrightVersion,
}: {
  containerName: string;
  image: string;
  playwrightVersion: string;
}): Promise<void> {
  try {
    await runDocker([
      "run",
      "--detach",
      "--rm",
      "--init",
      "--user",
      "pwuser",
      "--network",
      "host",
      "--name",
      containerName,
      "--label",
      `${PLAYWRIGHT_SERVER_VERSION_LABEL}=${playwrightVersion}`,
      image,
      "./serve.sh",
    ]);
  } catch (error) {
    // Another test run started the container first.
    if (readStderr(error).includes("is already in use")) {
      return;
    }

    throw error;
  }
}

/** Returns undefined while the container is not running or its server has not printed its port yet. */
async function readListeningPort(containerName: string): Promise<number | undefined> {
  const { stdout: runningState } = await runDocker([
    "inspect",
    "--format",
    "{{.State.Running}}",
    containerName,
  ]);
  if (runningState.trim() !== "true") {
    return undefined;
  }

  // `serve.sh` forwards the server output, including this line, to the container logs.
  const { stdout: logs } = await runDocker(["logs", containerName]);
  const port = /Listening on ws:\/\/0\.0\.0\.0:(?<port>\d+)/.exec(logs)?.groups?.["port"];
  return port === undefined ? undefined : Number(port);
}

/** Resets the idle timer of `serve.sh` in the container. */
async function markContainerAsUsed(containerName: string): Promise<void> {
  await runDocker(["exec", containerName, "touch", ACTIVITY_MARKER_PATH]);
}

function runDocker(
  args: string[],
  timeoutMs = DOCKER_COMMAND_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string }> {
  return execFile("docker", args, { timeout: timeoutMs });
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port, timeout: 1000 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

/** Playwright Server answers a plain HTTP request to its root with "Running". */
async function isPlaywrightServer(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok && (await response.text()) === "Running";
  } catch {
    return false;
  }
}

/** Tags the image by its content, so changing the image files builds and runs a new container. */
function hashImageFiles(): string {
  const hash = crypto.createHash("sha256");
  for (const fileName of IMAGE_FILE_NAMES) {
    hash.update(fs.readFileSync(path.join(IMAGE_DIRECTORY, fileName)));
  }

  return hash.digest("hex").slice(0, 12);
}

function readStderr(error: unknown): string {
  if (typeof error === "object" && error !== null && "stderr" in error) {
    return String(error.stderr);
  }

  return "";
}

function readInstalledPlaywrightVersion(): string {
  const require = module.createRequire(import.meta.url);
  const packageJson: unknown = require("@playwright/test/package.json");

  if (
    typeof packageJson !== "object" ||
    packageJson === null ||
    !("version" in packageJson) ||
    typeof packageJson.version !== "string"
  ) {
    throw new TypeError("@playwright/test/package.json must contain a string version");
  }

  return packageJson.version;
}
