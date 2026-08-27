// @ts-check

import { defineConfig } from "vitest/config";

export const config = defineConfig({
  ssr: {
    resolve: {
      /**
       * Include the Vitest user condition when resolving package imports and exports so packages
       * can expose test-only targets.
       *
       * See {@link https://nodejs.org/api/packages.html#resolving-user-conditions} and
       * {@link https://vitest.dev/guide/common-errors.html#custom-package-conditions-are-not-resolved}.
       */
      conditions: ["@patricktree-stack/vitest", "import", "default"],
    },
  },
  test: {
    /**
     * By default we should write tests which don't rely on side effects and properly cleanup state;
     * test isolation is not needed then, disabling it improves performance.
     *
     * See also {@link https://vitest.dev/guide/improving-performance.html#test-isolation}.
     */
    isolate: false,

    reporters: process.env.GITHUB_ACTIONS
      ? [
          "default",
          [
            "github-actions",
            {
              jobSummary: {
                // disable - in case we switch to vitest projects for better monorepo support, we can think about enabling it again
                enabled: false,
              },
            },
          ],
        ]
      : ["default"],

    coverage: {
      /**
       * Include unimported source modules so coverage represents the complete package rather than
       * only the modules reached by the test suite. The extension matrix also supports custom
       * transforms for variants such as `.mtsx` and `.ctsx`.
       *
       * See {@link https://vitest.dev/config/coverage.html#coverage-include}.
       */
      include: ["src/**/*.{js,jsx,cjs,cjsx,mjs,mjsx,ts,tsx,cts,ctsx,mts,mtsx}"],

      /** Tests and type declarations do not contribute executable production behavior. */
      exclude: [
        "src/**/*.{test,spec}.{js,jsx,cjs,cjsx,mjs,mjsx,ts,tsx,cts,ctsx,mts,mtsx}",
        "src/**/*.d.{ts,tsx,cts,ctsx,mts,mtsx}",
      ],

      /** Use the runtime's native coverage data without adding an instrumentation transform. */
      provider: "v8",

      /** Support terminal feedback, machine-readable processing, and local browser inspection. */
      reporter: ["text", "json", "html"],
    },
  },
});
