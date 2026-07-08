import { defineConfig } from "oxfmt";

import { config as baseConfig } from "@patricktree-stack/config-oxfmt/oxfmt-base.js";

export default defineConfig({
  ...baseConfig,
  sortImports: {
    customGroups: [
      /* create a group for patricktree packages to separate them from other external dependencies */
      {
        groupName: "patricktree-packages",
        elementNamePattern: ["@patricktree-stack/**"],
      },
      /* create a group for subpath imports = internal dependencies */
      {
        groupName: "subpath-imports",
        elementNamePattern: ["#src/**"],
      },
      /* create a group for subpath imports for test modules */
      {
        groupName: "subpath-imports-test-modules",
        elementNamePattern: ["#test/**"],
      },
      /* create a group for subpath imports for E2E test modules */
      {
        groupName: "subpath-imports-test-modules-e2e",
        elementNamePattern: ["#test-e2e/**"],
      },
    ],
    groups: [
      ["value-builtin", "value-external"],
      "value-external",
      "value-internal",
      "patricktree-packages",
      "subpath-imports",
      "subpath-imports-test-modules",
      "subpath-imports-test-modules-e2e",
      ["value-parent", "value-sibling", "value-index"],
      "unknown",
    ],
  },
});
