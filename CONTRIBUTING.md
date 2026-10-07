## How to contribute

This repo use [![neostandard Javascript Code Style](https://badgen.net/static/neo/standard/green)](https://github.com/neostandard/neostandard) js style, please use it if you want to contribute.

Take tasks from todo list, develop a new feature or fix a bug and do a pull request.  
Another thing that you can do to contribute is to build something on top of poolifier and link poolifier to your project.

Please do your PR on **master** branch.

### Development setup

Install [mise](https://mise.jdx.dev/getting-started.html) and review `mise.toml`, then run from the repository root:

```bash
mise trust
mise install
mise exec -- pnpm install --ignore-scripts --frozen-lockfile
mise exec -- pnpm build
```

`mise.toml` pins Node.js for the repository, including the TypeScript examples. mise reads each project's pnpm version from its `package.json` `packageManager` field; Corepack is not required. Renovate updates these version sources automatically. The CI compatibility matrix remains independent of the local Node.js pin.

Use `mise exec --` before the pnpm commands below, or [activate mise in your shell](https://mise.jdx.dev/getting-started.html#activate-mise) to run them directly. When replacing Volta, remove its PATH setup and `VOLTA_*` variables from your shell configuration, then restart terminals and editors so Volta shims do not take precedence.

**How to run unit tests and coverage**

```bash
  pnpm test:coverage
```

**How to check if your new code is standard JS style**

```bash
  pnpm lint
```

**How to format and lint to standard JS style your code**

```bash
  pnpm format && pnpm lint:fix
```

### Project pillars

Please consider our pillars before to start change the project

- Performance :white_check_mark:
- Security :white_check_mark:
- No runtime dependencies :white_check_mark: (until now we don't have any exception to that)
- Easy to use :white_check_mark:
- Code quality :white_check_mark:
