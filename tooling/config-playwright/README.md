# @patricktree-stack/config-playwright

Shared Playwright configuration that runs the browsers in a Playwright Server Docker container, so visual assertions match across host operating systems. See [Consistent visual assertions via Playwright Server in Docker](https://patricktree.me/blog/consistent-visual-assertions-via-playwright-server-in-docker) for the rationale.

## Usage

Spread the shared configuration into the package's `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

import { createPlaywrightDockerConfig } from "@patricktree-stack/config-playwright/playwright-docker";

export default defineConfig({
  ...createPlaywrightDockerConfig(),
  testDir: "./tests",
});
```

The configuration sets `globalSetup` to attach the run to the Playwright Server. A package that needs its own global setup must pass both, for example as an array. Set `PWDEBUG=1` to run headed browsers on the host instead of in Docker.

## Shared Playwright Server container

All test runs on a machine that use the same Playwright version share one Playwright Server container. Global setup attaches a run to that container and starts it when none is running. Each worker connects to it and gets its own browser, so concurrent runs stay isolated.

The first run on a machine builds the image `patricktree-stack/playwright-server:v<version>-<hash>` from [`playwright-server-image`](playwright-server-image/). The hash covers the image files, so changing them builds a new image. Later runs reuse the image.

The container name is derived from the image tag. Docker rejects a second container with the same name, so runs that start at the same time end up with one container. The server listens on a port the operating system assigns, and each run reads it from the container logs. On Docker Desktop that port is assigned in the Linux VM, so a host process can already hold it; global setup then removes the container and starts a new one on another port.

Test runs never stop the container. It stops itself once no client has been connected for 10 minutes, and `--rm` removes it. While a test runner process is alive, including between runs in UI mode, it sends a heartbeat every minute, so the container does not stop under an open UI. A runner that exits or crashes stops sending heartbeats.

The containers carry the label `patricktree-stack.playwright-server.version=<version>`. List or remove all of them:

```sh
docker ps --filter label=patricktree-stack.playwright-server.version
docker rm --force $(docker ps --quiet --filter label=patricktree-stack.playwright-server.version)
```

Removing a container fails the test runs that are using it.
