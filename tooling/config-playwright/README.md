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

The first run on a machine builds the image `patricktree-stack/playwright-server:v<version>` for the installed Playwright version. Later runs reuse it. Set `PWDEBUG=1` to run headed browsers on the host instead of in Docker.

## Target the container of one test run

Several test runs, for example from parallel agent sessions, can run Playwright Server containers from the same image at the same time. Never stop containers by image (`docker ps --filter ancestor=...`), because that also stops the servers of other runs.

Each container carries two labels:

- `patricktree-stack.playwright-server=<run id>` identifies one test run. The id is a random UUID per configuration load, exported as `PLAYWRIGHT_SERVER_RUN_ID`.
- `patricktree-stack.playwright-server.directory=<directory>` holds the working directory the test run started in, usually the consuming package.

To know the run id in advance, set it when starting the run:

```sh
PLAYWRIGHT_SERVER_RUN_ID=my-run pnpm exec playwright test
```

List and stop the containers of that run:

```sh
docker ps --filter label=patricktree-stack.playwright-server=my-run
docker stop $(docker ps --quiet --filter label=patricktree-stack.playwright-server=my-run)
```

Without a preset id, list the containers started from one package and read the run id from the labels:

```sh
docker ps --filter "label=patricktree-stack.playwright-server.directory=$PWD" --format '{{.ID}} {{.Label "patricktree-stack.playwright-server"}} {{.RunningFor}}'
```

Playwright stops the container with `SIGTERM` when the test run ends, and `--rm` removes it afterwards. Stop a container manually only when its test run is gone.
