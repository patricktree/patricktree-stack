import { defineConfig } from "oxfmt";

export const config = defineConfig({
  ignorePatterns: [
    /* pnpm-workspace.yaml is managed by pnpm */
    "/pnpm-workspace.yaml",
  ],
  sortPackageJson: {
    sortScripts: true,
  },
  jsdoc: true,
});
