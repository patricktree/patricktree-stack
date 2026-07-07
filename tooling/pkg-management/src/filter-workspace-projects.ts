import { filterPackages } from "@pnpm/filter-workspace-packages";
import assert from "node:assert";

import { findWorkspaceProjects, type Project } from "#src/find-workspace-projects.ts";

/**
 * @param filter Pnpm-style filter, e.g. ["@patricktree-stack/o11y.logs...",
 *   "@patricktree-stack/pkg-management..."]. See also https://pnpm.io/filtering.
 */
export const filterWorkspaceProjects = async (opts: {
  monorepoPackagePrefix: string;
  filter: string[];
  followProdDepsOnly: boolean;
}): Promise<Project[]> => {
  const { monorepoRootDir, rootProject, workspaceProjects } = await findWorkspaceProjects();

  const { selectedProjectsGraph, unmatchedFilters } = await filterPackages(
    [rootProject, ...workspaceProjects],
    opts.filter.map((filterElem) => ({
      filter: filterElem,
      followProdDepsOnly: opts.followProdDepsOnly,
    })),
    { workspaceDir: monorepoRootDir, prefix: `${opts.monorepoPackagePrefix}/` },
  );
  assert(
    unmatchedFilters.length === 0,
    `no filter should have got 0 matches, but got some! unmatchedFilters=${JSON.stringify(
      unmatchedFilters,
    )}`,
  );

  return Object.values(selectedProjectsGraph).map((selectedProject) => selectedProject.package);
};
