// See https://patricktree.me/blog/consistent-visual-assertions-via-playwright-server-in-docker for the rationale behind running Playwright Server in Docker.
import type { PlaywrightTestConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

import { PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME } from "./playwright-server-global-setup.ts";

const DEFAULT_MAX_WORKERS = 4;
const PLAYWRIGHT_SERVER_GLOBAL_SETUP_PATH = path.join(
  import.meta.dirname,
  "playwright-server-global-setup.ts",
);

export type CreatePlaywrightDockerConfigOptions = {
  isCI?: boolean;
  isDebuggingSession?: boolean;
  maxWorkers?: number;
  shouldUseDocker?: boolean;
};

export function createPlaywrightDockerConfig({
  // oxlint-disable-next-line node/no-process-env -- Playwright configuration is selected through environment flags.
  isCI = Boolean(process.env["CI"]),
  // oxlint-disable-next-line node/no-process-env -- PWDEBUG is Playwright's standard debugging flag.
  isDebuggingSession = process.env["PWDEBUG"] === "1",
  maxWorkers = DEFAULT_MAX_WORKERS,
  shouldUseDocker = !isDebuggingSession,
}: CreatePlaywrightDockerConfigOptions = {}): PlaywrightTestConfig {
  return {
    fullyParallel: true,

    /** Increase timeout to 30 minutes and set workers count to 1 in a debugging session. */
    ...(isDebuggingSession ? { timeout: 1000 * 60 * 30 } : {}),
    workers: isDebuggingSession ? 1 : Math.min(maxWorkers, os.availableParallelism()),

    // Fail a Playwright run in CI if some test.only is in the source code.
    forbidOnly: isCI,

    snapshotPathTemplate: `{testDir}/../snapshots/{testFilePath}/{arg}-{projectName}-${shouldUseDocker ? "docker" : "{platform}"}{ext}`,

    ...(shouldUseDocker
      ? {
          // Attaches the run to the Playwright Server container that all test runs of this Playwright
          // version share, starting it when none is running. The container stops itself once idle,
          // so there is no global teardown.
          globalSetup: PLAYWRIGHT_SERVER_GLOBAL_SETUP_PATH,
          use: {
            connectOptions: {
              wsEndpoint: `ws://127.0.0.1:${
                // oxlint-disable-next-line node/no-process-env -- Global setup passes the port to the workers through the environment.
                process.env[PLAYWRIGHT_SERVER_PORT_ENV_VAR_NAME] ?? ""
              }/`,
            },
          },
        }
      : {}),
  };
}
