# Copilot Instructions (repository-wide, language-agnostic)

These instructions guide GitHub Copilot to generate changes consistent with this repository's conventions, regardless of programming language.

## Glossary

- **Tunables**: user-adjustable parameters that shape behavior, exposed via options or configuration files.
- **Canonical defaults**: the single, authoritative definition of all tunables and their defaults.

## Implementation guidance for Copilot

- **Before coding**:
  - Perform a comprehensive inventory of the codebase. Search for and read:
    - README.md, CONTRIBUTING.md, and all other documentation files.
    - code files related to the task.
  - Identify existing code architecture, design patterns, canonical defaults, naming patterns and coding styles.
- **When coding**:
  - Follow the core principles and TypeScript/Node.js conventions below.
  - Follow identified design patterns, naming patterns and coding styles.
- **After coding**:
  - Ensure changes pass quality gates below.
- **When adding a tunable**:
  - Add to canonical defaults with safe value.
  - Ensure the options and configuration section below is respected.
  - Update documentation and serialization.
- **When implementing analytical methods**:
  - Follow statistical conventions below.
- **When refactoring**:
  - Keep public APIs stable; provide aliases if renaming unless explicitly requested.
  - Update code, tests, and documentation atomically.
- **When documenting**:
  - Follow documentation conventions below.

## Core principles

- **Design patterns**: prefer established patterns (e.g., factory, singleton, strategy) for code organization and extensibility.
- **Algorithmic**: prefer algorithms or heuristics solving the problem while minimizing time and space complexity.
- **DRY**: avoid duplication of logic, data, and naming. Factor out commonalities.
- **Single source of truth**: maintain a canonical defaults map for configuration tunables. Derive all user-facing options automatically.
- **Naming coherence**: prefer semantically accurate names across code, documentation, directories, and outputs. Avoid synonyms that create ambiguity.
- **English-only**: code, tests, logs, comments, and documentation must be in English.
- **Small, verifiable changes**: prefer minimal diffs that keep public behavior stable unless explicitly requested.
- **Tests-first mindset**: add or update minimal tests before refactoring or feature changes.
- **Documentation standards**: must follow established standards for programming languages.

## Options and configuration

- **Dynamic generation**: derive CLI and configuration options automatically from canonical defaults. Avoid manual duplication.
- **Merge precedence**: defaults < user options < explicit overrides (highest precedence). Never silently drop user-provided values.
- **Validation**: enforce constraints (choices, ranges, types) at the option layer with explicit typing.
- **Help text**: provide concrete examples for complex options, especially override mechanisms.

## Statistical conventions

- **Hypothesis testing**: use a single test statistic (e.g., t-test) when possible.
- **Divergence metrics**: document direction explicitly (e.g., KL(A||B) vs KL(B||A)); normalize distributions; add numerical stability measures.
- **Effect sizes**: report alongside test statistics and p-values; use standard formulas; document directional interpretation.
- **Distribution comparisons**: use multiple complementary metrics (parametric and non-parametric).
- **Multiple testing**: document corrections or acknowledge their absence.

## Reporting conventions

- **Structure**: start with run configuration, then stable section order for comparability.
- **Format**: use structured formats (e.g., tables) for metrics; avoid free-form text for data.
- **Interpretation**: include threshold guidelines; avoid overclaiming certainty.
- **Artifacts**: timestamp outputs; include configuration metadata.

## Documentation conventions

- **Clarity**: plain, unambiguous language; avoid marketing jargon and speculation.
- **Concision**: remove boilerplate; state facts directly without redundant phrasing.
- **Structure**: use consistent section ordering; follow stable patterns for comparable content.
- **Timeliness**: document current state; exclude historical evolution (except brief API breaking change notes).
- **Terminology**: use correct and consistent terminology; distinguish clearly between related concepts.
- **Exhaustivity**: cover all user-facing behavior and constraints; omit internal implementation details unless necessary for usage.
- **Pertinence**: include information that aids understanding or usage; remove tangential content.
- **No duplication**: maintain single authoritative documentation source; reference other sources rather than copying.

Documentation serves as an operational specification, not narrative prose.

## TypeScript/Node.js conventions

- **Naming**: Use camelCase for variables/functions/methods, PascalCase for classes/types/enums/interfaces.
- **Async operations**: Prefer async/await over raw Promises; handle rejections explicitly with try/catch.
- **Error handling**: Use typed errors with structured properties when applicable.
- **Worker communication**: Use broadcast channels for decoupled worker<->main thread messaging.
- **Null safety**: Avoid non-null assertions (!); use optional chaining (?.) and nullish coalescing (??).
- **Type safety**: Prefer explicit types over any; use type guards and discriminated unions where appropriate.
- **Promise patterns**: Return Promises from async operations; store resolvers/rejectors in Maps for request/response flows.
- **Immutability**: Avoid mutating shared state; clone objects before modification when needed.

## Quality gates

- Documented build/lint/type checks pass (where applicable).
- Documented tests pass (where applicable).
- Documentation updated to reflect changes when necessary.
- Logs use appropriate levels (error, warn, info, debug).
- Pull request title and commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format.

## Examples

### Naming coherence

**Good** (consistent style, clear semantics):

```typescript
const thresholdValue = 0.06
const processingMode = 'piecewise'
type ChargingStationStatus = 'Available' | 'Preparing' | 'Charging'
```

**Bad** (mixed styles, ambiguous):

```typescript
const threshold_value = 0.06    // inconsistent case style
const thresholdAim = 0.06       // synonym creates ambiguity
type charging_station_status    // wrong casing for type
```

### Promise-based request/response pattern

**Good** (proper async flow):

```typescript
protected handleProtocolRequest(
  uuid: string,
  procedureName: ProcedureName,
  payload: RequestPayload
): Promise<ResponsePayload> {
  return new Promise<ResponsePayload>((resolve, reject) => {
    this.pendingRequests.set(uuid, { reject, resolve })
    this.sendBroadcastChannelRequest(uuid, procedureName, payload)
  })
}
```

**Bad** (returns void, no Promise):

```typescript
protected handleProtocolRequest(
  uuid: string,
  procedureName: ProcedureName,
  payload: RequestPayload
): void {
  this.sendBroadcastChannelRequest(uuid, procedureName, payload)
  // Response never reaches caller!
}
```

### Statistical reporting

```markdown
| Metric      | Value | Interpretation        |
| ----------- | ----- | --------------------- |
| KL(A‖B)     | 0.023 | < 0.1: low divergence |
| Effect size | 0.12  | small to medium       |
```

---

By following these instructions, Copilot should propose changes that are consistent and maintainable across languages.
