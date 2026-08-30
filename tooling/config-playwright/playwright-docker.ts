// See https://patricktree.me/blog/consistent-visual-assertions-via-playwright-server-in-docker for the rationale behind running Playwright Server in Docker.
import type { PlaywrightTestConfig } from "@playwright/test";
import module from "node:module";
import os from "node:os";

const PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME = "PLAYWRIGHT_SERVER_PORT";
const DEFAULT_MAX_WORKERS = 4;

export type CreatePlaywrightDockerConfigOptions = {
  isCI?: boolean;
  isDebuggingSession?: boolean;
  maxWorkers?: number;
  reuseExistingServer?: boolean;
  shouldUseDocker?: boolean;
};

export function createPlaywrightDockerConfig({
  // oxlint-disable-next-line node/no-process-env -- Playwright configuration is selected through environment flags.
  isCI = Boolean(process.env["CI"]),
  // oxlint-disable-next-line node/no-process-env -- PWDEBUG is Playwright's standard debugging flag.
  isDebuggingSession = process.env["PWDEBUG"] === "1",
  maxWorkers = DEFAULT_MAX_WORKERS,
  reuseExistingServer = !isCI,
  shouldUseDocker = !isDebuggingSession,
}: CreatePlaywrightDockerConfigOptions = {}): PlaywrightTestConfig {
  const playwrightVersion = readInstalledPlaywrightVersion();

  return {
    fullyParallel: true,

    /** Increase timeout to 30 minutes and set workers count to 1 in a debugging session. */
    ...(isDebuggingSession ? { timeout: 1000 * 60 * 30 } : {}),
    workers: isDebuggingSession ? 1 : Math.min(maxWorkers, os.availableParallelism()),

    // Fail a Playwright run in CI if some test.only is in the source code.
    forbidOnly: isCI,

    snapshotPathTemplate: `{testDir}/../snapshots/{testFilePath}/{arg}-{projectName}-${shouldUseDocker ? "docker" : "{platform}"}{ext}`,

    use: {
      ...(shouldUseDocker
        ? {
            connectOptions: {
              wsEndpoint: `ws://127.0.0.1:${
                // oxlint-disable-next-line node/no-process-env -- Port is provided by Playwright server stdout via webServer.wait.stdout.
                process.env[PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME] ?? ""
              }/`,
            },
          }
        : {}),
    },

    ...(shouldUseDocker
      ? {
          webServer: {
            // Start Playwright Server in a Docker container so visual assertions are consistent across host operating systems.
            command: `docker run --rm --init --workdir /home/pwuser --user pwuser --network host mcr.microsoft.com/playwright:v${playwrightVersion}-noble /bin/sh -c "npx -y playwright@${playwrightVersion} run-server --host 0.0.0.0"`,
            wait: {
              // Capture the Playwright Server port from stdout via regex (https://playwright.dev/docs/api/class-testconfig#test-config-web-server).
              // eslint-disable-next-line prefer-regex-literals -- Named capture group is interpolated from the environment variable name.
              stdout: new RegExp(
                String.raw`Listening on ws:\/\/0\.0\.0\.0:(?<${PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME}>\d+)`,
              ),
            },
            stdout: "pipe",
            stderr: "pipe",
            timeout: 30_000,
            gracefulShutdown: {
              signal: "SIGTERM",
              timeout: 10_000,
            },
            reuseExistingServer,
          },
        }
      : {}),
  };
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
