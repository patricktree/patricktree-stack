// Derives and builds the Playwright Server image that the global setup runs. Tooling that keys or
// prepares that image, such as a cache key reader, imports these functions so it cannot drift from
// the image the test runs use.
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import module from "node:module";
import path from "node:path";
import util from "node:util";

// The first build on a machine pulls the Playwright base image and installs Playwright from npm.
const IMAGE_BUILD_TIMEOUT_MS = 300_000;
const IMAGE_DIRECTORY = path.join(import.meta.dirname, "playwright-server-image");
const IMAGE_FILE_NAMES = ["Dockerfile", "serve.sh"];

const execFile = util.promisify(childProcess.execFile);

export type PlaywrightServerImage = {
  /** Version of `@playwright/test` that this package resolves, which the image installs. */
  playwrightVersion: string;
  /** Docker build context of the image. */
  directory: string;
  /** `v<playwright version>-<image files hash>`, the tag's version part. */
  imageVersion: string;
  /** Full image tag, `patricktree-stack/playwright-server:<image version>`. */
  tag: string;
  /** Tag of the Playwright image that the Dockerfile builds on. */
  baseImageTag: string;
};

export function derivePlaywrightServerImage(): PlaywrightServerImage {
  const playwrightVersion = readInstalledPlaywrightVersion();
  const imageVersion = `v${playwrightVersion}-${hashImageFiles()}`;

  return {
    playwrightVersion,
    directory: IMAGE_DIRECTORY,
    imageVersion,
    tag: `patricktree-stack/playwright-server:${imageVersion}`,
    baseImageTag: `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`,
  };
}

/**
 * Builds the image, whether or not it exists. Concurrent builds are identical, so either result
 * serves.
 */
export async function buildPlaywrightServerImage(image: PlaywrightServerImage): Promise<void> {
  await execFile(
    "docker",
    [
      "build",
      "--quiet",
      "--build-arg",
      `PLAYWRIGHT_VERSION=${image.playwrightVersion}`,
      "--tag",
      image.tag,
      image.directory,
    ],
    { timeout: IMAGE_BUILD_TIMEOUT_MS },
  );
}

/** Tags the image by its content, so changing the image files builds and runs a new container. */
function hashImageFiles(): string {
  const hash = crypto.createHash("sha256");
  for (const fileName of IMAGE_FILE_NAMES) {
    hash.update(fs.readFileSync(path.join(IMAGE_DIRECTORY, fileName)));
  }

  return hash.digest("hex").slice(0, 12);
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
