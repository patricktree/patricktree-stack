import { defineConfig, mergeConfig } from "vitest/config";

import { config as baseConfig } from "@patricktree-stack/config-vitest/vitest-base.js";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      /*
       * Each test drives real git: about 20 git processes, most of them the CLI's own. Under a
       * consuming repository's full parallel build and test run, single git processes stalled for
       * hundreds of milliseconds, which outlasted Vitest's 5 s default, though each test passes
       * alone in under half a second.
       */
      testTimeout: 20_000,
    },
  }),
);
