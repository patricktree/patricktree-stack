import { defineConfig, mergeConfig } from "vitest/config";

import { config as baseConfig } from "@patricktree-stack/config-vitest/vitest-base.js";

export default mergeConfig(baseConfig, defineConfig({}));
