# Priority Queue Aging Tunables

## TL;DR

> **Quick Summary**: Add `agingFactor` and `loadExponent` as configurable tunables to `TasksQueueOptions`, enabling users to customize the priority queue anti-starvation mechanism currently using hardcoded values.
>
> **Deliverables**:
>
> - Extended `TasksQueueOptions` interface with two new optional properties
> - Validation logic for the new options
> - Default values in `getDefaultTasksQueueOptions()`
> - Options threading through AbstractPool → WorkerNode → PriorityQueue → FixedPriorityQueue
> - Extended test coverage
>
> **Estimated Effort**: Medium (8 files modified, ~150 lines changed)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request

Add tunables for the priority queue aging mechanism in Poolifier. Currently hardcoded values (`agingFactor=0.001` and `loadExponent=1.0/1.5`) need to become configurable options at the `TasksQueueOptions` level.

### Interview Summary

**Key Discussions**:

- Configuration level: `TasksQueueOptions` (pool-level, not task-function-level)
- Naming convention: `agingFactor`, `loadExponent` (simple names consistent with existing options)
- Default constants: Internal only, not exported publicly
- Tests: Extend existing tests, only create new if indispensable

**Research Findings**:

- No universal standard for aging factor values (Kubernetes, Slurm use configurable params)
- Configuration flow: PoolOptions → TasksQueueOptions → WorkerNodeOptions → PriorityQueue → FixedPriorityQueue
- Current formula: `effectivePriority = node.priority - (now - node.timestamp) * effectiveAgingFactor`
- `effectiveAgingFactor = agingFactor * (1 + ((size+1)/capacity)^loadExponent)`

### Metis Review

**Identified Gaps** (addressed):

- Missing PriorityQueue constructor modification (added to plan)
- Validation bounds needed (added: agingFactor >= 0, loadExponent > 0)
- Runtime mutability unclear (documented as construction-time only)
- Behavior when priority disabled (silent acceptance, consistent with other options)

---

## Work Objectives

### Core Objective

Make the priority queue anti-starvation mechanism configurable by exposing `agingFactor` and `loadExponent` as optional properties in `TasksQueueOptions`.

### Concrete Deliverables

- `TasksQueueOptions.agingFactor?: number` and `TasksQueueOptions.loadExponent?: number`
- Default values: `agingFactor = 0.001`, `loadExponent = 1.0/1.5` (≈0.667)
- Validation: `agingFactor >= 0`, `loadExponent > 0`
- Complete options threading from pool config to `FixedPriorityQueue`
- Extended tests for validation and configuration propagation

### Definition of Done

- [ ] `pnpm lint` passes with 0 errors
- [ ] `pnpm format` completes successfully
- [ ] `pnpm test` passes with 0 failures
- [ ] New options documented with JSDoc
- [ ] Options propagate from `TasksQueueOptions` to `FixedPriorityQueue`

### Must Have

- `agingFactor` and `loadExponent` in `TasksQueueOptions` interface
- Default values matching current hardcoded behavior
- Validation rejecting invalid values (non-number, out of range)
- Options threading through entire chain
- Tests for validation and defaults

### Must NOT Have (Guardrails)

- Per-task-function aging configuration — pool-level only
- Runtime aging modification via `setTasksQueueOptions()` — construction-time only
- Formula changes — only make existing constants configurable
- `disableAging: boolean` option — use `agingFactor: 0` instead
- Exported default constants — keep internal
- Time-based behavioral tests — too flaky, out of scope

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (extend existing test files)
- **Framework**: bun test
- **Pattern**: Follow existing validation tests in `tests/pools/abstract-pool.test.mjs`

### QA Policy

Every task includes agent-executed verification commands.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Validation**: Use Bash (bun test) — run test commands, assert exit code 0
- **Linting**: Use Bash (pnpm lint/format) — verify no errors
- **Type checking**: Use Bash (pnpm build) — verify compilation succeeds

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — interfaces and defaults):
├── Task 1: Add properties to TasksQueueOptions interface [quick]
├── Task 2: Add default constants to queue-types.ts [quick]
└── Task 3: Update getDefaultTasksQueueOptions() [quick]

Wave 2 (After Wave 1 — validation and threading):
├── Task 4: Add validation to checkValidTasksQueueOptions() (depends: 1) [quick]
├── Task 5: Add properties to WorkerNodeOptions (depends: 1) [quick]
└── Task 6: Update PriorityQueue constructor (depends: 2) [quick]

Wave 3 (After Wave 2 — wiring and tests):
├── Task 7: Update AbstractPool.createWorkerNode() (depends: 3, 5) [quick]
├── Task 8: Update WorkerNode constructor (depends: 5, 6) [quick]
├── Task 9: Update PriorityQueue.getPriorityQueueNode() (depends: 6) [quick]
└── Task 10: Add/extend tests (depends: 4, 7, 8, 9) [unspecified-high]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
└── Task F3: Full test suite and lint verification (quick)

Critical Path: Task 1 → Task 4 → Task 7 → Task 10 → F1-F3
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
| ---- | ---------- | ------ |
| 1    | —          | 4, 5   |
| 2    | —          | 6      |
| 3    | —          | 7      |
| 4    | 1          | 10     |
| 5    | 1          | 7, 8   |
| 6    | 2          | 8, 9   |
| 7    | 3, 5       | 10     |
| 8    | 5, 6       | 10     |
| 9    | 6          | 10     |
| 10   | 4, 7, 8, 9 | F1-F3  |

### Agent Dispatch Summary

- **Wave 1**: 3 tasks → `quick` (simple interface/constant additions)
- **Wave 2**: 3 tasks → `quick` (validation logic, interface updates)
- **Wave 3**: 4 tasks → 3 `quick` + 1 `unspecified-high` (tests)
- **Wave FINAL**: 3 tasks → `oracle`, `unspecified-high`, `quick`

---

## TODOs

- [ ] 1. Add agingFactor and loadExponent to TasksQueueOptions interface

  **What to do**:
  - Add `agingFactor?: number` property to `TasksQueueOptions` interface
  - Add `loadExponent?: number` property to `TasksQueueOptions` interface
  - Add JSDoc comments explaining each option's purpose and default behavior
  - Follow existing property patterns in the interface (optional with `?`)

  **Must NOT do**:
  - Export default constants
  - Add validation logic here (separate task)
  - Add to any other interface in this task

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple interface extension, 2 properties + JSDoc
  - **Skills**: []
    - No special skills needed for interface modification
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/pools/pool.ts:366-397` - `TasksQueueOptions` interface with existing optional properties pattern

  **API/Type References**:
  - `src/pools/pool.ts:TasksQueueOptions` - Interface to modify

  **WHY Each Reference Matters**:
  - TasksQueueOptions shows naming convention (camelCase, optional `?`) and JSDoc style for properties

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TypeScript compilation with new properties
    Tool: Bash
    Preconditions: Clean working directory
    Steps:
      1. Run `pnpm build`
      2. Check exit code is 0
    Expected Result: Build succeeds with new interface properties
    Failure Indicators: TypeScript errors, non-zero exit code
    Evidence: .sisyphus/evidence/task-1-build.txt

  Scenario: Property exists in compiled output
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run `grep -l "agingFactor" src/pools/pool.ts`
      2. Run `grep -l "loadExponent" src/pools/pool.ts`
    Expected Result: Both properties found in source file
    Failure Indicators: grep returns empty/non-zero
    Evidence: .sisyphus/evidence/task-1-grep.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 2. Add default constants to queue-types.ts

  **What to do**:
  - Add `export const defaultAgingFactor = 0.001` constant
  - Add `export const defaultLoadExponent = 1.0 / 1.5` constant (≈0.667)
  - Add brief comment explaining the default values
  - Place near existing `defaultBucketSize` and `defaultQueueSize` constants

  **Must NOT do**:
  - Export from main index.ts (internal constants only)
  - Change existing constants
  - Add validation logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding 2 constant declarations
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/queues/queue-types.ts:1-10` - Existing default constants pattern

  **WHY Each Reference Matters**:
  - Shows naming convention (`default*`) and export style for constants

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Constants are defined correctly
    Tool: Bash
    Preconditions: File modified
    Steps:
      1. Run `grep "defaultAgingFactor" src/queues/queue-types.ts`
      2. Run `grep "defaultLoadExponent" src/queues/queue-types.ts`
      3. Run `pnpm build`
    Expected Result: Both constants found, build succeeds
    Failure Indicators: Constants missing, build fails
    Evidence: .sisyphus/evidence/task-2-constants.txt

  Scenario: Constants not exported from main index
    Tool: Bash
    Preconditions: Build completed
    Steps:
      1. Run `grep -c "defaultAgingFactor\|defaultLoadExponent" src/index.ts`
    Expected Result: Count is 0 (not exported publicly)
    Failure Indicators: Count > 0
    Evidence: .sisyphus/evidence/task-2-no-export.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 3. Update getDefaultTasksQueueOptions() with aging defaults

  **What to do**:
  - Import `defaultAgingFactor` and `defaultLoadExponent` from queue-types.ts
  - Add `agingFactor: defaultAgingFactor` to returned object
  - Add `loadExponent: defaultLoadExponent` to returned object
  - Maintain existing `Object.freeze()` pattern

  **Must NOT do**:
  - Hardcode values (use imported constants)
  - Change function signature
  - Modify other default functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding 2 properties to return object + import
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 7
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/pools/utils.ts:40-51` - `getDefaultTasksQueueOptions()` function

  **API/Type References**:
  - `src/queues/queue-types.ts` - Source of default constants

  **WHY Each Reference Matters**:
  - Shows return object structure and `Object.freeze()` pattern to maintain

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Defaults include aging properties
    Tool: Bash
    Preconditions: File modified
    Steps:
      1. Run `grep "agingFactor" src/pools/utils.ts`
      2. Run `grep "loadExponent" src/pools/utils.ts`
      3. Run `pnpm build`
    Expected Result: Both properties in defaults function, build succeeds
    Failure Indicators: Properties missing, build fails
    Evidence: .sisyphus/evidence/task-3-defaults.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 4. Add validation to checkValidTasksQueueOptions()

  **What to do**:
  - Add validation for `agingFactor`: must be number if provided, must be >= 0
  - Add validation for `loadExponent`: must be number if provided, must be > 0
  - Follow existing validation pattern (e.g., `tasksStealingRatio` validation)
  - Use `TypeError` for non-number, `RangeError` for out-of-range values

  **Must NOT do**:
  - Add validation for other options
  - Change error message format
  - Add warning for aging options when priority disabled (silent acceptance)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pattern-following validation logic
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 10
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/pools/utils.ts:198-213` - `tasksStealingRatio` validation pattern (type check + range check)
  - `src/pools/utils.ts:162-214` - Full `checkValidTasksQueueOptions()` function

  **WHY Each Reference Matters**:
  - tasksStealingRatio shows exact pattern: `typeof` check → `TypeError`, range check → `RangeError`
  - Error message format to match

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Valid values accepted
    Tool: Bash
    Preconditions: Validation added
    Steps:
      1. Run `pnpm build`
      2. Run `pnpm test -- --grep "tasks queue options"`
    Expected Result: Build and relevant tests pass
    Failure Indicators: Build fails, tests fail
    Evidence: .sisyphus/evidence/task-4-valid.txt

  Scenario: Invalid agingFactor rejected (type)
    Tool: Bash
    Preconditions: Validation added, test added
    Steps:
      1. Run test that passes `agingFactor: 'string'`
      2. Assert TypeError is thrown
    Expected Result: TypeError thrown with appropriate message
    Failure Indicators: No error or wrong error type
    Evidence: .sisyphus/evidence/task-4-aging-type.txt

  Scenario: Invalid loadExponent rejected (range)
    Tool: Bash
    Preconditions: Validation added, test added
    Steps:
      1. Run test that passes `loadExponent: 0`
      2. Assert RangeError is thrown
    Expected Result: RangeError thrown (loadExponent must be > 0)
    Failure Indicators: No error or wrong error type
    Evidence: .sisyphus/evidence/task-4-load-range.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 5. Add agingFactor and loadExponent to WorkerNodeOptions

  **What to do**:
  - Add `tasksQueueAgingFactor?: number` to `WorkerNodeOptions` interface
  - Add `tasksQueueLoadExponent?: number` to `WorkerNodeOptions` interface
  - Follow existing naming pattern (`tasksQueue*` prefix for queue-related options)

  **Must NOT do**:
  - Add JSDoc (internal interface)
  - Add validation (handled at TasksQueueOptions level)
  - Modify constructor yet (separate task)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple interface extension
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/pools/worker.ts:377-383` - `WorkerNodeOptions` interface with `tasksQueue*` properties

  **WHY Each Reference Matters**:
  - Shows naming convention (`tasksQueueBucketSize`, `tasksQueuePriority`) to follow

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: WorkerNodeOptions accepts new properties
    Tool: Bash
    Preconditions: Interface modified
    Steps:
      1. Run `grep "tasksQueueAgingFactor" src/pools/worker.ts`
      2. Run `grep "tasksQueueLoadExponent" src/pools/worker.ts`
      3. Run `pnpm build`
    Expected Result: Properties found, build succeeds
    Failure Indicators: Properties missing, build fails
    Evidence: .sisyphus/evidence/task-5-worker-opts.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 6. Update PriorityQueue constructor to accept aging options

  **What to do**:
  - Add `agingFactor?: number` parameter to `PriorityQueue` constructor
  - Add `loadExponent?: number` parameter to `PriorityQueue` constructor
  - Store as instance properties for use in `getPriorityQueueNode()`
  - Import and use default constants when not provided

  **Must NOT do**:
  - Update `getPriorityQueueNode()` yet (separate task)
  - Change existing parameter order
  - Add validation (trust upstream validation)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Constructor parameter addition
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/queues/priority-queue.ts:63-80` - `PriorityQueue` constructor

  **API/Type References**:
  - `src/queues/queue-types.ts` - Default constants to import

  **WHY Each Reference Matters**:
  - Constructor shows existing parameter pattern and where to store instance properties

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: PriorityQueue accepts aging parameters
    Tool: Bash
    Preconditions: Constructor modified
    Steps:
      1. Run `grep -A5 "constructor" src/queues/priority-queue.ts | grep "agingFactor\|loadExponent"`
      2. Run `pnpm build`
    Expected Result: Parameters in constructor, build succeeds
    Failure Indicators: Parameters missing, build fails
    Evidence: .sisyphus/evidence/task-6-pq-constructor.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 7. Update AbstractPool.createWorkerNode() to pass aging options

  **What to do**:
  - In `createWorkerNode()`, extract `agingFactor` and `loadExponent` from `this.opts.tasksQueueOptions`
  - Pass as `tasksQueueAgingFactor` and `tasksQueueLoadExponent` in `WorkerNodeOptions`
  - Follow existing pattern for `tasksQueueBucketSize` and `tasksQueuePriority`

  **Must NOT do**:
  - Add validation (already done in buildTasksQueueOptions)
  - Modify other methods
  - Change return type

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding 2 properties to options object
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 10)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 3, 5

  **References**:

  **Pattern References**:
  - `src/pools/abstract-pool.ts:1624-1639` - `createWorkerNode()` method
  - `src/pools/abstract-pool.ts:1630-1635` - Where `WorkerNodeOptions` is constructed

  **WHY Each Reference Matters**:
  - Shows how `tasksQueueBucketSize` and `tasksQueuePriority` are passed to match pattern

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Aging options passed to WorkerNodeOptions
    Tool: Bash
    Preconditions: Method modified
    Steps:
      1. Run `grep "tasksQueueAgingFactor" src/pools/abstract-pool.ts`
      2. Run `grep "tasksQueueLoadExponent" src/pools/abstract-pool.ts`
      3. Run `pnpm build`
    Expected Result: Both options passed, build succeeds
    Failure Indicators: Options missing, build fails
    Evidence: .sisyphus/evidence/task-7-create-worker.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 8. Update WorkerNode constructor to pass aging options to PriorityQueue

  **What to do**:
  - Extract `tasksQueueAgingFactor` and `tasksQueueLoadExponent` from constructor options
  - Pass to `PriorityQueue` constructor call
  - Handle undefined values (let PriorityQueue use defaults)

  **Must NOT do**:
  - Add validation
  - Modify other WorkerNode methods
  - Change tasksQueue type

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Passing 2 additional parameters
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9, 10)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `src/pools/worker-node.ts` - WorkerNode constructor where PriorityQueue is created

  **WHY Each Reference Matters**:
  - Shows where `new PriorityQueue()` is called and existing parameters passed

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: WorkerNode passes aging options to PriorityQueue
    Tool: Bash
    Preconditions: Constructor modified
    Steps:
      1. Run `grep -B2 -A5 "new PriorityQueue" src/pools/worker-node.ts`
      2. Run `pnpm build`
    Expected Result: Aging options visible in PriorityQueue call, build succeeds
    Failure Indicators: Options missing, build fails
    Evidence: .sisyphus/evidence/task-8-worker-node.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 9. Update PriorityQueue.getPriorityQueueNode() to pass aging to FixedPriorityQueue

  **What to do**:
  - In `getPriorityQueueNode()`, pass stored `agingFactor` and `loadExponent` to `FixedPriorityQueue` constructor
  - Use instance properties set in Task 6

  **Must NOT do**:
  - Modify FixedPriorityQueue constructor (already accepts these params)
  - Add validation
  - Change bucket size handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Passing 2 parameters to constructor call
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8, 10)
  - **Blocks**: Task 10
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `src/queues/priority-queue.ts:206-214` - `getPriorityQueueNode()` method
  - `src/queues/fixed-priority-queue.ts` - FixedPriorityQueue constructor signature

  **WHY Each Reference Matters**:
  - Shows where `new FixedPriorityQueue()` is called
  - FixedPriorityQueue constructor already accepts agingFactor and loadExponent

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: FixedPriorityQueue receives aging options
    Tool: Bash
    Preconditions: Method modified
    Steps:
      1. Run `grep -A3 "new FixedPriorityQueue" src/queues/priority-queue.ts`
      2. Run `pnpm build`
    Expected Result: Aging options passed to FixedPriorityQueue, build succeeds
    Failure Indicators: Options missing, build fails
    Evidence: .sisyphus/evidence/task-9-get-node.txt
  ```

  **Commit**: NO (groups with final commit)

- [ ] 10. Add/extend tests for aging options

  **What to do**:
  - Add validation tests in `tests/pools/abstract-pool.test.mjs`:
    - Test invalid `agingFactor` (non-number) throws TypeError
    - Test invalid `agingFactor` (negative) throws RangeError
    - Test invalid `loadExponent` (non-number) throws TypeError
    - Test invalid `loadExponent` (zero or negative) throws RangeError
    - Test valid values are accepted
    - Test defaults are applied when not specified
  - Extend existing priority queue tests in `tests/queues/priority-queue.test.mjs`:
    - Test PriorityQueue constructor accepts aging options
    - Test defaults used when options not provided

  **Must NOT do**:
  - Create new test files
  - Add time-based behavioral tests (flaky)
  - Test aging algorithm correctness (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple test cases requiring understanding of existing patterns
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - None applicable

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after infrastructure tasks)
  - **Blocks**: Final verification
  - **Blocked By**: Tasks 4, 7, 8, 9

  **References**:

  **Pattern References**:
  - `tests/pools/abstract-pool.test.mjs` - Existing validation tests for TasksQueueOptions
  - `tests/queues/priority-queue.test.mjs` - Existing PriorityQueue tests

  **Test References**:
  - Search for `tasksStealingRatio` tests to see validation test pattern
  - Search for `TasksQueueOptions` tests for options testing pattern

  **WHY Each Reference Matters**:
  - Shows test structure, assertion patterns, and how validation errors are tested

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All new tests pass
    Tool: Bash
    Preconditions: Tests added
    Steps:
      1. Run `bun test tests/pools/abstract-pool.test.mjs`
      2. Run `bun test tests/queues/priority-queue.test.mjs`
    Expected Result: All tests pass (exit code 0)
    Failure Indicators: Test failures, non-zero exit
    Evidence: .sisyphus/evidence/task-10-tests.txt

  Scenario: Full test suite passes
    Tool: Bash
    Preconditions: All implementation complete
    Steps:
      1. Run `pnpm test`
    Expected Result: 0 failures
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-10-full-suite.txt
  ```

  **Commit**: YES
  - Message: `feat(pool): add agingFactor and loadExponent tunables to TasksQueueOptions`
  - Files: All modified files from tasks 1-10
  - Pre-commit: `pnpm lint && pnpm format && pnpm test`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
      Run `pnpm build` + `pnpm lint` + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod. Check for consistent naming, proper JSDoc, no dead code.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [ ] F3. **Full Test Suite Verification** — `quick`
      Run full test suite: `pnpm test`. Verify 0 failures. Run `pnpm lint && pnpm format`. Verify exit code 0.
      Output: `Tests [PASS/FAIL] | Lint [PASS/FAIL] | Format [PASS/FAIL] | VERDICT`

---

## Commit Strategy

Single commit after all tasks complete:

- **Message**: `feat(pool): add agingFactor and loadExponent tunables to TasksQueueOptions`
- **Files**: All modified files from tasks 1-10
- **Pre-commit**: `pnpm lint && pnpm format && pnpm test`

---

## Success Criteria

### Verification Commands

```bash
# Build passes
pnpm build  # Expected: exit 0

# Lint passes
pnpm lint  # Expected: exit 0

# Format passes
pnpm format  # Expected: exit 0

# Tests pass
pnpm test  # Expected: exit 0, 0 failures

# Type check
npx tsc --noEmit  # Expected: exit 0
```

### Final Checklist

- [ ] `agingFactor` and `loadExponent` in `TasksQueueOptions`
- [ ] Default values applied when not specified
- [ ] Validation rejects invalid values
- [ ] Options propagate to `FixedPriorityQueue`
- [ ] All existing tests still pass
- [ ] New validation tests added
- [ ] JSDoc documentation complete
- [ ] No runtime mutability via `setTasksQueueOptions()`
