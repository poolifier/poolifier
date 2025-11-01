# Agent Guidelines for Poolifier

## Build/Test Commands

- `pnpm build` - Build for development
- `pnpm test` - Run all tests
- `pnpm test -- --grep "pattern"` - Run tests matching pattern
- `pnpm lint` - Run ESLint
- `pnpm format` - Format with Biome + ESLint fix

## Code Style

- **Imports**: Use `.js` extensions for TypeScript imports (Node16 module resolution)
- **Naming**: camelCase for variables/functions, PascalCase for classes/types/interfaces
- **Types**: Explicit types over `any`, use type guards and discriminated unions
- **Async**: Prefer async/await over raw Promises, handle rejections with try/catch
- **Formatting**: 2-space indent, single quotes, no semicolons, trailing commas (ES5)
- **Error Handling**: Use typed errors with structured properties

## Key Patterns

- Export types with `export type {}` syntax
- Use `.js` file extensions in imports even for `.ts` files
- Follow established factory/strategy patterns for pool implementations
- Maintain single source of truth for configuration defaults

## Repository Rules

See `.github/copilot-instructions.md` for comprehensive coding standards including DRY principles, naming coherence, and TypeScript conventions. Follow quality gates: lint, format, and test passes required.
