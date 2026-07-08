import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";

import { visualizeDirectoryTree, writeDirectoryTree } from "@patricktree-stack/test-utils-node";

import { createPrunedMonorepo } from "#src/create-pruned-monorepo.ts";

const originalCwd = process.cwd();
const temporaryDirs: string[] = [];

afterEach(async () => {
  process.chdir(originalCwd);

  await Promise.all(
    temporaryDirs
      .splice(0)
      .map((directoryPath) => fs.promises.rm(directoryPath, { force: true, recursive: true })),
  );
});

test("copies the selected project, production workspace dependencies, and monorepo root files", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   ├── app
      │   │   ├── public
      │   │   │   └── visible.txt
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   ├── README.md
      │   │   └── package.json
      │   ├── dev-helper
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   └── package.json
      │   └── shared
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      ├── pnpm-workspace.yaml
      └── root-file.txt
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml", "root-file.txt"],
      }),
      "packages/app/README.md": "# App\n",
      "packages/app/package.json": json({
        name: "@patricktree-stack/app",
        private: true,
        files: ["src", "public/*.txt"],
        dependencies: { "@patricktree-stack/shared": "workspace:*" },
        devDependencies: { "@patricktree-stack/dev-helper": "workspace:*" },
      }),
      "packages/app/public/visible.txt": "visible\n",
      "packages/app/src/index.ts": "export {};\n",
      "packages/dev-helper/package.json": json({
        name: "@patricktree-stack/dev-helper",
        private: true,
        files: ["src"],
      }),
      "packages/dev-helper/src/index.ts": "export {};\n",
      "packages/shared/package.json": json({
        name: "@patricktree-stack/shared",
        private: true,
        files: ["src"],
      }),
      "packages/shared/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
      "root-file.txt": "root file\n",
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree-stack/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree-stack/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── packages
    │   ├── app
    │   │   ├── public
    │   │   │   └── visible.txt
    │   │   ├── src
    │   │   │   └── index.ts
    │   │   └── package.json
    │   └── shared
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    ├── pnpm-workspace.yaml
    └── root-file.txt
    "
  `);
});

test("copies a linked monorepo project used by the consuming project", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── .linked-monorepo
      │   ├── libs
      │   │   └── observability
      │   │       ├── src
      │   │       │   └── index.ts
      │   │       └── package.json
      │   ├── package.json
      │   └── pnpm-workspace.yaml
      ├── packages
      │   └── app
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      ".linked-monorepo/libs/observability/package.json": json({
        name: "@patricktree-stack/observability",
        private: true,
        files: ["src"],
      }),
      ".linked-monorepo/libs/observability/src/index.ts": "export {};\n",
      ".linked-monorepo/package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      ".linked-monorepo/pnpm-workspace.yaml": 'packages:\n  - "libs/*"\n',
      "package.json": json({
        name: "@patricktree/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/package.json": json({
        name: "@patricktree/app",
        private: true,
        files: ["src"],
        dependencies: {
          "@patricktree-stack/observability": "link:../../.linked-monorepo/libs/observability",
        },
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── .linked-monorepo
    │   ├── libs
    │   │   └── observability
    │   │       ├── src
    │   │       │   └── index.ts
    │   │       └── package.json
    │   ├── package.json
    │   └── pnpm-workspace.yaml
    ├── packages
    │   └── app
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("copies production workspace dependencies of a linked monorepo project", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── .linked-monorepo
      │   ├── libs
      │   │   ├── observability
      │   │   │   ├── src
      │   │   │   │   └── index.ts
      │   │   │   └── package.json
      │   │   └── shared
      │   │       ├── src
      │   │       │   └── index.ts
      │   │       └── package.json
      │   ├── package.json
      │   └── pnpm-workspace.yaml
      ├── packages
      │   └── app
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      ".linked-monorepo/libs/observability/package.json": json({
        name: "@patricktree-stack/observability",
        private: true,
        files: ["src"],
        dependencies: { "@patricktree-stack/shared": "workspace:*" },
      }),
      ".linked-monorepo/libs/observability/src/index.ts": "export {};\n",
      ".linked-monorepo/libs/shared/package.json": json({
        name: "@patricktree-stack/shared",
        private: true,
        files: ["src"],
      }),
      ".linked-monorepo/libs/shared/src/index.ts": "export {};\n",
      ".linked-monorepo/package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      ".linked-monorepo/pnpm-workspace.yaml": 'packages:\n  - "libs/*"\n',
      "package.json": json({
        name: "@patricktree/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/package.json": json({
        name: "@patricktree/app",
        private: true,
        files: ["src"],
        dependencies: {
          "@patricktree-stack/observability": "link:../../.linked-monorepo/libs/observability",
        },
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── .linked-monorepo
    │   ├── libs
    │   │   ├── observability
    │   │   │   ├── src
    │   │   │   │   └── index.ts
    │   │   │   └── package.json
    │   │   └── shared
    │   │       ├── src
    │   │       │   └── index.ts
    │   │       └── package.json
    │   ├── package.json
    │   └── pnpm-workspace.yaml
    ├── packages
    │   └── app
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("copies linked monorepo root files and production workspace dependencies", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── .linked-monorepo
      │   ├── libs
      │   │   └── observability
      │   │       ├── src
      │   │       │   └── index.ts
      │   │       └── package.json
      │   ├── tooling
      │   │   └── root-config
      │   │       ├── config.json
      │   │       └── package.json
      │   ├── package.json
      │   ├── pnpm-workspace.yaml
      │   └── root-file.txt
      ├── packages
      │   └── app
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      ".linked-monorepo/libs/observability/package.json": json({
        name: "@patricktree-stack/observability",
        private: true,
        files: ["src"],
      }),
      ".linked-monorepo/libs/observability/src/index.ts": "export {};\n",
      ".linked-monorepo/package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml", "root-file.txt"],
        dependencies: { "@patricktree-stack/root-config": "workspace:*" },
      }),
      ".linked-monorepo/pnpm-workspace.yaml": 'packages:\n  - "libs/*"\n  - "tooling/*"\n',
      ".linked-monorepo/root-file.txt": "root file\n",
      ".linked-monorepo/tooling/root-config/config.json": "{}\n",
      ".linked-monorepo/tooling/root-config/package.json": json({
        name: "@patricktree-stack/root-config",
        private: true,
        files: ["config.json"],
      }),
      "package.json": json({
        name: "@patricktree/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/package.json": json({
        name: "@patricktree/app",
        private: true,
        files: ["src"],
        dependencies: {
          "@patricktree-stack/observability": "link:../../.linked-monorepo/libs/observability",
        },
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── .linked-monorepo
    │   ├── libs
    │   │   └── observability
    │   │       ├── src
    │   │       │   └── index.ts
    │   │       └── package.json
    │   ├── tooling
    │   │   └── root-config
    │   │       ├── config.json
    │   │       └── package.json
    │   ├── package.json
    │   ├── pnpm-workspace.yaml
    │   └── root-file.txt
    ├── packages
    │   └── app
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("copies linked .linked-monorepo dependencies when the consuming project uses a package alias", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── .linked-monorepo
      │   ├── my-lib
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   └── package.json
      │   ├── package.json
      │   └── pnpm-workspace.yaml
      ├── packages
      │   └── app
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      ".linked-monorepo/my-lib/package.json": json({
        name: "my-lib",
        private: true,
        files: ["src"],
      }),
      ".linked-monorepo/my-lib/src/index.ts": "export {};\n",
      ".linked-monorepo/package.json": json({
        name: "stack-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      ".linked-monorepo/pnpm-workspace.yaml": 'packages:\n  - "my-lib"\n',
      "package.json": json({
        name: "@patricktree/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/package.json": json({
        name: "@patricktree/app",
        private: true,
        files: ["src"],
        dependencies: {
          "@patricktree-stack-aliased/aliased": "link:../../.linked-monorepo/my-lib",
        },
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── .linked-monorepo
    │   ├── my-lib
    │   │   ├── src
    │   │   │   └── index.ts
    │   │   └── package.json
    │   ├── package.json
    │   └── pnpm-workspace.yaml
    ├── packages
    │   └── app
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("includes all selected projects and their production workspace dependencies", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   ├── app-one
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   └── package.json
      │   ├── app-two
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   └── package.json
      │   └── shared
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app-one/package.json": json({
        name: "@patricktree-stack/app-one",
        private: true,
        files: ["src"],
      }),
      "packages/app-one/src/index.ts": "export {};\n",
      "packages/app-two/package.json": json({
        name: "@patricktree-stack/app-two",
        private: true,
        files: ["src"],
        dependencies: { "@patricktree-stack/shared": "workspace:*" },
      }),
      "packages/app-two/src/index.ts": "export {};\n",
      "packages/shared/package.json": json({
        name: "@patricktree-stack/shared",
        private: true,
        files: ["src"],
      }),
      "packages/shared/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree-stack/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree-stack/app-one", "@patricktree-stack/app-two"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── packages
    │   ├── app-one
    │   │   ├── src
    │   │   │   └── index.ts
    │   │   └── package.json
    │   ├── app-two
    │   │   ├── src
    │   │   │   └── index.ts
    │   │   └── package.json
    │   └── shared
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("throws when an included project does not declare package files", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   └── app
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/package.json": json({
        name: "@patricktree-stack/app",
        private: true,
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await expect(
    createPrunedMonorepo({
      monorepoPackagePrefix: "@patricktree",
      monorepoRootProjectName: "@patricktree-stack/monorepo-root",
      linkedMonorepoDirName: ".linked-monorepo",
      projectNames: ["@patricktree-stack/app"],
      targetDir: prunedMonorepoDir,
    }),
  ).rejects.toThrow('Expected project @patricktree-stack/app to have "files" field');
});

test("copies transitive production workspace dependencies", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   ├── app
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   └── package.json
      │   ├── shared
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   └── package.json
      │   └── util
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/package.json": json({
        name: "@patricktree-stack/app",
        private: true,
        files: ["src"],
        dependencies: { "@patricktree-stack/shared": "workspace:*" },
      }),
      "packages/app/src/index.ts": "export {};\n",
      "packages/shared/package.json": json({
        name: "@patricktree-stack/shared",
        private: true,
        files: ["src"],
        dependencies: { "@patricktree-stack/util": "workspace:*" },
      }),
      "packages/shared/src/index.ts": "export {};\n",
      "packages/util/package.json": json({
        name: "@patricktree-stack/util",
        private: true,
        files: ["src"],
      }),
      "packages/util/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree-stack/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree-stack/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── packages
    │   ├── app
    │   │   ├── src
    │   │   │   └── index.ts
    │   │   └── package.json
    │   ├── shared
    │   │   ├── src
    │   │   │   └── index.ts
    │   │   └── package.json
    │   └── util
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("copies production workspace dependencies of the monorepo root", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   ├── app
      │   │   ├── src
      │   │   │   └── index.ts
      │   │   └── package.json
      │   └── build-config
      │       ├── config.json
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
        dependencies: { "@patricktree-stack/build-config": "workspace:*" },
      }),
      "packages/app/package.json": json({
        name: "@patricktree-stack/app",
        private: true,
        files: ["src"],
      }),
      "packages/app/src/index.ts": "export {};\n",
      "packages/build-config/config.json": '{"extends":"@patricktree-stack/base"}\n',
      "packages/build-config/package.json": json({
        name: "@patricktree-stack/build-config",
        private: true,
        files: ["config.json"],
      }),
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree-stack/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree-stack/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── packages
    │   ├── app
    │   │   ├── src
    │   │   │   └── index.ts
    │   │   └── package.json
    │   └── build-config
    │       ├── config.json
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("preserves matched symlinks instead of dereferencing them", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   └── app
      │       ├── src
      │       │   └── index.ts
      │       ├── index-link.ts --> src/index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/package.json": json({
        name: "@patricktree-stack/app",
        private: true,
        files: ["src", "index-link.ts"],
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree-stack/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree-stack/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── packages
    │   └── app
    │       ├── src
    │       │   └── index.ts
    │       ├── index-link.ts --> src/index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("excludes node_modules even when package files include it", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   └── app
      │       ├── node_modules
      │       │   └── ignored
      │       │       └── index.js
      │       ├── src
      │       │   └── index.ts
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/node_modules/ignored/index.js": "module.exports = {};\n",
      "packages/app/package.json": json({
        name: "@patricktree-stack/app",
        private: true,
        files: ["src", "node_modules"],
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree-stack/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree-stack/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── packages
    │   └── app
    │       ├── src
    │       │   └── index.ts
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

test("copies matched dotfiles and files inside matched dot directories", async () => {
  const monorepoDir = await createTemporaryDirectory();
  const prunedMonorepoDir = await createTemporaryDirectory();

  await writeDirectoryTree(
    monorepoDir,
    `
      ./
      ├── packages
      │   └── app
      │       ├── .config
      │       │   └── tool.json
      │       ├── src
      │       │   └── index.ts
      │       ├── .env.example
      │       └── package.json
      ├── package.json
      └── pnpm-workspace.yaml
    `,
    {
      "package.json": json({
        name: "@patricktree-stack/monorepo-root",
        private: true,
        files: ["pnpm-workspace.yaml"],
      }),
      "packages/app/.config/tool.json": "{}\n",
      "packages/app/.env.example": "EXAMPLE=true\n",
      "packages/app/package.json": json({
        name: "@patricktree-stack/app",
        private: true,
        files: ["src", ".env.example", ".config"],
      }),
      "packages/app/src/index.ts": "export {};\n",
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n',
    },
  );

  process.chdir(monorepoDir);
  await createPrunedMonorepo({
    monorepoPackagePrefix: "@patricktree",
    monorepoRootProjectName: "@patricktree-stack/monorepo-root",
    linkedMonorepoDirName: ".linked-monorepo",
    projectNames: ["@patricktree-stack/app"],
    targetDir: prunedMonorepoDir,
  });

  expect(await visualizeDirectoryTree(prunedMonorepoDir)).toMatchInlineSnapshot(`
    "./
    ├── packages
    │   └── app
    │       ├── .config
    │       │   └── tool.json
    │       ├── src
    │       │   └── index.ts
    │       ├── .env.example
    │       └── package.json
    ├── package.json
    └── pnpm-workspace.yaml
    "
  `);
});

async function createTemporaryDirectory(): Promise<string> {
  const directoryPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pruned-monorepo-test-"));
  temporaryDirs.push(directoryPath);
  return directoryPath;
}

function json(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
