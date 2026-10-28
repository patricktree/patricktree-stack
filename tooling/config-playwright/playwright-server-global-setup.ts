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
const PLAYWRIGHT_SERVER_IDLE_TIMEOUT_ENV_VAR_NAME = "PLAYWRIGHT_SERVER_IDLE_TIMEOUT_SECONDS";
const DEFAULT_IDLE_TIMEOUT_SECONDS = 600;
// The first run on a machine builds the server image, which installs Playwright from npm.
const STARTUP_TIMEOUT_MS = 120_000;
// Bounds each Docker call other than the image build, so an unresponsive Docker daemon cannot block the run.
const DOCKER_COMMAND_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 500;
const IMAGE_DIRECTORY = path.join(import.meta.dirname, "playwright-server-image");
const IMAGE_FILE_NAMES = ["Dockerfile", "serve.sh"];
// Must match the activity marker in `serve.sh`, whose idle timer this file resets.
const ACTIVITY_MARKER_PATH = "/tmp/last-used";

const execFile = util.promisify(childProcess.execFile);

export default async function globalSetup(): Promise<void> {
  const port = await ensurePlaywrightServer();

  // Workers inherit the environment of the runner process and read the port in the shared configuration.
  // oxlint-disable-next-line node/no-process-env -- Passes the port from global setup to the workers.
  process.env[PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME] = String(port);
}

async function ensurePlaywrightServer(): Promise<number> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  const playwrightVersion = readInstalledPlaywrightVersion();
  // The image files hash is part of both names, so changing the image files never attaches a run to
  // a container of the previous image.
  const imageVersion = `v${playwrightVersion}-${hashImageFiles()}`;
  const image = `patricktree-stack/playwright-server:${imageVersion}`;
  // Docker rejects a second container with the same name, so the name is the lock that keeps
  // concurrently starting test runs from creating more than one container per version.
  const containerName = `patricktree-stack-playwright-server-${imageVersion}`;

  await ensureImage({ image, playwrightVersion, deadline });

  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await startContainer({ containerName, image, playwrightVersion });

      // The container may be stopping because it was idle; the next iteration then starts a new one.
      const port = await readListeningPort(containerName);
      if (port !== undefined) {
        await runDocker(["exec", containerName, "touch", ACTIVITY_MARKER_PATH]);

        if (await canConnect(port)) {
          return port;
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

async function ensureImage({
  image,
  playwrightVersion,
  deadline,
}: {
  image: string;
  playwrightVersion: string;
  deadline: number;
}): Promise<void> {
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
      Math.max(deadline - Date.now(), 1),
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
      String(readIdleTimeoutSeconds()),
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

function readIdleTimeoutSeconds(): number {
  // oxlint-disable-next-line node/no-process-env -- The idle timeout belongs to the machine-wide container, not to one repository's configuration.
  const rawIdleTimeoutSeconds = process.env[PLAYWRIGHT_SERVER_IDLE_TIMEOUT_ENV_VAR_NAME];
  if (rawIdleTimeoutSeconds === undefined) {
    return DEFAULT_IDLE_TIMEOUT_SECONDS;
  }

  const idleTimeoutSeconds = Number(rawIdleTimeoutSeconds);
  if (!Number.isInteger(idleTimeoutSeconds) || idleTimeoutSeconds <= 0) {
    throw new TypeError(
      `${PLAYWRIGHT_SERVER_IDLE_TIMEOUT_ENV_VAR_NAME} must be a positive integer, got "${rawIdleTimeoutSeconds}"`,
    );
  }

  return idleTimeoutSeconds;
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
