# patricktree-stack

`patricktree-stack` contains shared, source-level building blocks for Patrick
Kerschbaum's TypeScript repositories. Consuming repositories pin it as the
`.patricktree-stack` Git submodule and include only the projects they need in
their pnpm workspace.

This workflow replaces publishing personal utilities and configuration
packages to npm. Every package in this repository is private and intended for
workspace consumption. The repository does not provide a stable third-party
API or independent releases.

## Contents

- `tooling/` contains shared TypeScript, Oxfmt, Oxlint, Turborepo, Vitest,
  Next.js, Stylelint, and WyW-in-JS configuration, plus monorepo tooling.
- `libs/` contains reusable ECMA, Node.js, React, observability, favicon, and
  sitemap utilities.
- `qa-utils/` contains shared test helpers.
- `.github/actions/bootstrap-repo/` contains the composite action that installs
  pnpm, the repository's configured Node.js runtime, and dependencies.

## Add the stack to a repository

From the root of a consuming repository, add the submodule and track its
`main` branch:

```sh
git submodule add \
  -b main \
  https://github.com/patricktree/patricktree-stack \
  .patricktree-stack
```

Add only the required stack projects to the consuming repository's
`pnpm-workspace.yaml`. For example:

```yaml
packages:
  - .patricktree-stack/tooling/config-oxfmt
  - .patricktree-stack/tooling/config-oxlint
  - .patricktree-stack/tooling/config-typescript
```

Reference the selected projects through the pnpm workspace protocol:

```json
{
  "devDependencies": {
    "@patricktree-stack/config-oxfmt": "workspace:*",
    "@patricktree-stack/config-oxlint": "workspace:*",
    "@patricktree-stack/config-typescript": "workspace:*"
  }
}
```

After cloning a consuming repository, initialize its pinned stack revision:

```sh
git submodule update --init --recursive
```

## Update the pinned revision

Fetch the latest `main` revision into a consuming repository:

```sh
git submodule update --remote .patricktree-stack
pnpm install
```

Validate the consuming repository, then commit its updated
`.patricktree-stack` Git reference together with any required integration
changes. Consumers remain on their recorded revision until they explicitly
update that reference.

## Development model

This repository deliberately has no root `package.json` or
`pnpm-workspace.yaml`. Develop and validate stack projects through a consuming
repository, where dependency catalogs, root tooling, and integration tests are
available.
