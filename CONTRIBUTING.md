## How to contribute

This repo use [![neostandard Javascript Code Style](https://badgen.net/static/neo/standard/green)](https://github.com/neostandard/neostandard) js style, please use it if you want to contribute.

Take tasks from todo list, develop a new feature or fix a bug and do a pull request.  
Another thing that you can do to contribute is to build something on top of poolifier and link poolifier to your project.

Please do your PR on **master** branch.

**How to run unit tests and coverage**

```bash
  pnpm test:coverage
```

For promise deadlines in regression tests, use `bounded(promise, message?, timeoutMs?)` from `tests/test-utils.cjs`.
It preserves the result or rejection and rejects with the supplied message on timeout. Use a contextual message when diagnosing a specific stage.
Keep non-fatal cleanup deadlines separate.

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
