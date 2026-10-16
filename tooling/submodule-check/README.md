# Submodule check

`submodule-check` rejects changes that move a submodule pointer, such as `.patricktree-stack`, backwards. A lagging submodule checkout is easy to stage by accident, for example with `git add -A` while resolving rebase conflicts, and the resulting commit silently reverts a submodule update on `main`.

## Checks

A pointer moves backwards when a change records a commit that is an ancestor of the pointer it replaces or of the pointer on `origin/main`. Merge commits are compared against each parent. A pointer is compared against `origin/main` only if the branch changed it, so a branch that predates a submodule update on `main` is not affected. Forward moves and moves to unrelated commits pass as well. The check covers every submodule that `.gitmodules` declares.

| Command                                 | Checks                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `submodule-check staged`                | Staged pointers against `HEAD`, and against `origin/main` if they differ from the merge base                                |
| `submodule-check commits <revision...>` | Each commit that is reachable from the revisions but not on a remote-tracking branch, against its parents and `origin/main` |

When `origin/main` is unavailable, both commands compare against `HEAD` or the parent commits only and say so. If the submodule checkout lacks one of the commits, the check fails and asks you to fetch it.

## Use in a consuming repository

Add the project to `pnpm-workspace.yaml` and the root `package.json`:

```yaml
packages:
  - .patricktree-stack/tooling/submodule-check
```

```json
{
  "devDependencies": {
    "@patricktree-stack/submodule-check": "workspace:*"
  }
}
```

Run the staged check from the pre-commit hook, for example `.husky/pre-commit`:

```sh
pnpm exec submodule-check staged
```

Commits that `git rebase --continue` creates skip the pre-commit hook, so also check every pushed commit from the pre-push hook, for example `.husky/pre-push`:

```sh
pushed_oids=""
while read -r local_ref local_oid remote_ref remote_oid; do
    if [ "${local_ref}" != "(delete)" ]; then
        pushed_oids="${pushed_oids} ${local_oid}"
    fi
done
if [ -n "${pushed_oids}" ]; then
    # pushed_oids is unquoted so that each object ID becomes a separate argument
    pnpm exec submodule-check commits ${pushed_oids} || exit $?
fi
```

## Fix a failure

The failure message names both commits and the commands to record the newer commit and sync the submodule checkout, for example:

```sh
git update-index --cacheinfo 160000,<newer commit>,.patricktree-stack
git submodule update -- .patricktree-stack
```

For a commit that the pre-push check rejects, amend that commit or rewrite it with `git rebase -i`. If the submodule checkout lacks one of the commits, run `git -C .patricktree-stack fetch origin` or `git submodule update` and retry. If a downgrade is intended, bypass the hook with `--no-verify`.
