# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.6.2] - 2023-06-12

### Fixed

- Fix new worker use after creation in dynamic pool given the current worker choice strategy.

## [2.6.1] - 2023-06-10

### Added

- Add worker choice strategy documentation: [README.md](./src/pools/selection-strategies/README.md).

### Fixed

- Fix average statistics computation: ensure failed tasks are not accounted.

## [2.6.0] - 2023-06-09

### Added

- Add `LEAST_ELU` worker choice strategy (experimental).
- Add tasks ELU instead of runtime support to `FAIR_SHARE` worker choice strategy.

### Changed

- Refactor pool worker node usage internals.
- Breaking change: refactor worker choice strategy statistics requirements: the syntax of the worker choice strategy options has changed.
- Breaking change: pool information `info` property object fields have been renamed.

### Fixed

- Fix wait time accounting.
- Ensure worker choice strategy `LEAST_BUSY` accounts also tasks wait time.
- Ensure worker choice strategy `LEAST_USED` accounts also queued tasks.

## [2.5.4] - 2023-06-07

### Added

- Add Event Loop Utilization (ELU) statistics to worker tasks usage.

### Changed

- Compute statistics at the worker level only if needed.
- Add `worker-threads` options to thread pool options.

### Fixed

- Make the `LEAST_BUSY` strategy only relies on task runtime.

## [2.5.3] - 2023-06-04

### Changed

- Refine pool information content.
- Limit pool internals public exposure.

## [2.5.2] - 2023-06-02

### Added

- Add `taskError` pool event for task execution error.
- Add pool information `info` property to pool.
- Emit pool information on `busy` and `full` pool events.

## [2.5.1] - 2023-06-01

### Added

- Add pool option `restartWorkerOnError` to restart worker on uncaught error. Default to `true`.
- Add `error` pool event for uncaught worker error.

## [2.5.0] - 2023-05-31

### Added

- Switch pool event emitter to `EventEmitterAsyncResource`.
- Add tasks wait time accounting in per worker tasks usage.
- Add interleaved weighted round robin `INTERLEAVED_WEIGHTED_ROUND_ROBIN` worker choice strategy (experimental).

### Changed

- Renamed worker choice strategy `LESS_BUSY` to `LEAST_BUSY` and `LESS_USED` to `LEAST_USED`.

## [2.4.14] - 2023-05-09

### Fixed

- Ensure no undefined task runtime can land in the tasks history.
- Fix median computation implementation once again.

### Added

- Unit tests for median and queue implementations.

## [2.4.13] - 2023-05-08

### Fixed

- Fix worker choice strategy options validation.
- Fix fair share worker choice strategy internals update: ensure virtual task end timestamp is computed at task submission.

## [2.4.12] - 2023-05-06

### Added

- Support multiple task functions per worker.
- Add custom worker weights support to worker choice strategies options.

### Changed

- Use O(1) queue implementation for tasks queueing.

### Fixed

- Fix median computation implementation.
- Fix fair share worker choice strategy internals update.

## [2.4.11] - 2023-04-23

### Changed

- Optimize free worker finding in worker choice strategies.

## [2.4.10] - 2023-04-15

### Fixed

- Fix typescript type definition for worker function: ensure the input data is optional.
- Fix typescript type definition for pool execute(): ensure the input data is optional.

## [2.4.9] - 2023-04-15

### Added

- Add tasks queue enablement runtime setter to pool.
- Add tasks queue options runtime setter to pool.
- Add worker choice strategy options runtime setter to pool.

### Changed

- Remove the tasks queuing experimental status.

### Fixed

- Fix worker function type definition and validation.
- Fix worker choice strategy options handling.

## [2.4.8] - 2023-04-12

### Fixed

- Fix message between main worker and worker type definition for tasks.
- Fix code documentation.

## [2.4.7] - 2023-04-11

### Added

- Add worker tasks queue options to pool options.

### Fixed

- Fix missing documentation.

## [2.4.6] - 2023-04-10

### Fixed

- Ensure one task at a time is executed per worker with tasks queueing enabled.
- Properly count worker executing tasks with tasks queueing enabled.

## [2.4.5] - 2023-04-09

### Added

- Use monotonic high resolution timer for worker tasks runtime.
- Add worker tasks median runtime to statistics.
- Add worker tasks queue (experimental).

## [2.4.4] - 2023-04-07

### Added

- Add `PoolEvents` enumeration and `PoolEvent` type.

### Fixed

- Destroy worker only on alive check.

## [2.4.3] - 2023-04-07

### Fixed

- Fix typedoc generation with inheritance.

## [2.4.2] - 2023-04-06

### Added

- Add `full` event to dynamic pool.
- Keep worker choice strategy in memory for conditional reuse.

### Fixed

- Fix possible negative worker key at worker removal in worker choice strategies.

## [2.4.1] - 2023-04-05

### Changed

- Optimize worker choice strategy for dynamic pool.

### Fixed

- Ensure dynamic pool does not alter worker choice strategy expected behavior.

## [2.4.0] - 2023-04-04

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.
- Update benchmarks versus external threads pools.
- Optimize tasks usage statistics requirements for worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.
- Fix package publication with pnpm.

## [2.4.0-3] - 2023-04-04

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.
- Update benchmarks versus external threads pools.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.
- Fix package publication with pnpm.

## [2.4.0-2] - 2023-04-03

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.
- Fix package publication with pnpm.

## [2.4.0-1] - 2023-04-03

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.

## [2.4.0-0] - 2023-04-03

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.

## [2.3.10] - 2023-03-18

### Fixed

- Fix `exports` syntax for ESM and CommonJS.

### Changed

- Permit SemVer pre-release publication.

## [2.3.10-2] - 2023-03-18

### Fixed

- Fix `exports` syntax for ESM and CommonJS.

## [2.3.10-1] - 2023-03-18

### Changed

- Permit SemVer pre-release publication.

## [2.3.10-0] - 2023-03-18

### Fixed

- Fix `exports` syntax for ESM and CommonJS.

## [2.3.9] - 2023-03-18

### Changed

- Introduce ESM module support along with CommonJS one.

### Fixed

- Fix brown paper bag bug referencing the same object literal.

## [2.3.8] - 2023-03-18

### Changed

- Switch internal benchmarking code to benny.
- Switch to TypeScript 5.x.x.
- Switch rollup bundler plugins to core ones.
- Switch to TSDoc syntax.
- Enforce conventional commits.

### Fixed

- Fix random integer generator.
- Fix worker choice strategy pool type identification at initialization.

## [2.3.7] - 2022-10-23

### Changed

- Switch to open collective FOSS project funding platform.
- Switch to ts-standard linter configuration on TypeScript code.

### Fixed

- Fixed missing async on pool execute method.
- Fixed typing in TypeScript example.
- Fixed types in unit tests.

## [2.3.6] - 2022-10-22

### Changed

- Cleanup pool attributes and methods.
- Refine error types thrown.

### Fixed

- Fix continuous integration build on windows.
- Fix code coverage reporting by using c8 instead of nyc.

## [2.3.5] - 2022-10-21

### Changed

- Improve benchmarks: add IO intensive task workload, add task size option, integrate code into linter.
- Optimize tasks usage lookup implementation.

### Fixed

- Fix missed pool event emitter type export.
- Fix typedoc documentation generation.

## [2.3.4] - 2022-10-17

### Added

- Fully automate release process with release-it.

### Changed

- Optimize fair share task scheduling algorithm implementation.
- Update benchmarks versus external pools results with latest version.

## [2.3.3] - 2022-10-15

### Added

- Add support for [cluster settings](https://nodejs.org/api/cluster.html#cluster_cluster_settings) in cluster pool options.

## [2.3.2] - 2022-10-14

### Changed

- Optimize fair share worker selection strategy implementation.

### Fixed

- Fix WRR worker selection strategy: ensure the condition triggering the round robin can be fulfilled.

## [2.3.1] - 2022-10-13

### Added

- Pool worker choice strategies:
  - `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN` strategy based on weighted round robin scheduling algorithm using tasks execution time for now.
  - `WorkerChoiceStrategies.FAIR_SHARE` strategy based on fair share scheduling algorithm using tasks execution time for now.

## [2.2.2] - 2022-10-09

### Fixed

- Fixed `README.md` file.

## [2.2.1] - 2022-10-08

### Added

- Dynamic worker choice strategy change at runtime.

## [2.2.0] - 2022-01-05

### Breaking Changes

- Support only NodeJS version 16.x.x for cluster pool: upstream cluster API have changed on that version.

## [2.1.0] - 2021-08-29

### Added

- Add an optional pool option `messageHandler` to `PoolOptions<Worker>` for registering a message handler callback on each worker.

### Breaking Changes

- `AbstractWorker` class `maxInactiveTime`, `killBehavior` and `async` attributes have been removed in favour of the same ones in the worker options `opts` public attribute.
- `AbstractWorker` class `lastTask` attribute have been renamed to `lastTaskTimestamp`.
- `AbstractWorker` class `interval` attribute have been renamed to `aliveInterval`.
- `AbstractWorker` class cannot be instantiated without specifying the `mainWorker` argument referencing the main worker.

## [2.0.2] - 2021-05-12

### Bug fixes

- Fix `busy` event emission on fixed pool type

## [2.0.1] - 2021-03-16

### Bug fixes

- Check if pool options are properly set.
- `busy` event is emitted on all pool types.

## [2.0.0] - 2021-03-01

### Bug fixes

- Now a thread/process by default is not deleted when the task submitted take more time than maxInactiveTime configured (issue #70).

### Breaking Changes

- `FullPool` event is now renamed to `busy`.
- `maxInactiveTime` on `ThreadWorker` default behavior is now changed, if you want to keep the old behavior set `killBehavior` to `KillBehaviors.HARD`.
  _Find more details on our JSDoc._

- `maxTasks` option on `FixedThreadPool` and `DynamicThreadPool` is now removed since is no more needed.

- We changed some internal structures, but you shouldn't be too affected by them as these are internal changes.

### Pool options types declaration merge

`FixedThreadPoolOptions` and `DynamicThreadPoolOptions` type declarations have been merged to `PoolOptions<Worker>`.

#### New `export` strategy

```js
// Before
const DynamicThreadPool = require('poolifier/lib/dynamic')
// After
const { DynamicThreadPool } = require('poolifier/lib/dynamic')
```

But you should always prefer just using

```js
const { DynamicThreadPool } = require('poolifier')
```

#### New type definitions for input data and response

For cluster worker and worker-thread pools, you can now only send and receive serializable data.  
_This is not a limitation by poolifier but NodeJS._

#### Public property replacements

`numWorkers` property is now `numberOfWorkers`

#### Internal (protected) properties and methods renaming

These properties are not intended for end users

- `id` => `nextMessageId`

These methods are not intended for end users

- `_chooseWorker` => `chooseWorker`
- `_newWorker` => `createWorker`
- `_execute` => `internalExecute`
- `_chooseWorker` => `chooseWorker`
- `_checkAlive` => `checkAlive`
- `_run` => `run`
- `_runAsync` => `runAsync`

## [1.1.0] - 2020-05-21

### Added

- ThreadWorker support async functions as option
- Various external library patches

## [1.0.0] - 2020-01-24

### Added

- FixedThreadPool implementation
- DynamicThreadPool implementation
- WorkerThread implementation to improve developer experience
