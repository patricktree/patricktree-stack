// @ts-check

import { defineConfig } from "oxfmt";

/** @typedef {{ patricktreeStackGitSubmoduleRelativePath: string }} CreateOxfmtConfigOptions */

/** @param {CreateOxfmtConfigOptions} opts */
export const createBaseConfig = (opts) => {
  const config = defineConfig({
    ignorePatterns: [
      /* pnpm-workspace.yaml is managed by pnpm */
      "/pnpm-workspace.yaml",
    ],
    sortPackageJson: {
      sortScripts: true,
    },
    jsdoc: true,

    overrides: [
      {
        files: [`${opts.patricktreeStackGitSubmoduleRelativePath}/**`],
        options: {
          sortImports: {
            customGroups: [
              /* create a group for patricktree-stack packages to separate them from other external dependencies */
              {
                groupName: "patricktree-stack-packages",
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
              "patricktree-stack-packages",
              "subpath-imports",
              "subpath-imports-test-modules",
              "subpath-imports-test-modules-e2e",
              ["value-parent", "value-sibling", "value-index"],
              "unknown",
            ],
          },
        },
      },
    ],
  });
  return config;
};
