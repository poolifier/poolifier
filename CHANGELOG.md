# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add fine grained task abortion support.

## [3.0.8] - 2023-11-25

### Fixed

- Ensure continuous tasks stealing on idle start at worker node idling

## [3.0.7] - 2023-11-24

### Changed

- Make continuous tasks stealing start at worker node idling.

## [3.0.6] - 2023-11-24

### Fixed

- Ensure pool statuses are checked at initialization, `start()` or `destroy()`.
- Ensure pool `ready` event can be emitted after several `start()/destroy()` cycles.

## [3.0.5] - 2023-10-27

### Fixed

- Ensure pool `ready` event can be emitted only once.

## [3.0.4] - 2023-10-20

### Changed

- Switch to Bencher for benchmarking: [https://bencher.dev/perf/poolifier](https://bencher.dev/perf/poolifier).
- Use builtin retry mechanism in worker choice strategies instead of custom one.

## [3.0.3] - 2023-10-19

### Fixed

- Avoid null exception at sending message to worker.
- Avoid null exception at checking worker node readiness.

## [3.0.2] - 2023-10-17

### Fixed

- Fix race condition at dynamic worker node task assignment and scheduled removal. See issue [#1468](https://github.com/poolifier/poolifier/issues/1468) and [#1496](https://github.com/poolifier/poolifier/issues/1496).

## [3.0.1] - 2023-10-16

### Fixed

- Workaround possible race condition at work nodes array element removal and querying. See issue [#1468](https://github.com/poolifier/poolifier/issues/1468).

### Changed

- Switch the worker node eventing code to `EventTarget` API.

## [3.0.0] - 2023-10-08

### Changed

- Remove Node.js 16.x.x (EOL) support.

## [2.7.5] - 2023-10-03

### Changed

- Use `EventEmitterAsyncResource` type from `@types/node` for pool event emitter. TypeScript users will need to update to latest `@types/node` version.

## [2.7.4] - 2023-09-25

### Fixed

- Fix source maps (bundler issue).

## [2.7.3] - 2023-09-24

### Changed

- Convert pool event emitter to event emitter async resource.

## [2.7.2] - 2023-09-23

### Changed

- Add source maps to npm package to ease debugging.

### Added

- Continuous benchmarking versus other worker pools: [https://poolifier.github.io/benchmark](https://poolifier.github.io/benchmark).

## [2.7.1] - 2023-09-20

### Fixed

- Ensure worker message listener used one time are removed after usage.

## [2.7.0] - 2023-09-19

### Fixed

- Fix task stealing related tasks queue options handling at runtime.

### Changed

- Rename `listTaskFunctions()` to `listTaskFunctionNames()` in pool and worker API.

### Added

- Add `hasTaskFunction()`, `addTaskFunction()`, `removeTaskFunction()`, `setDefaultTaskFunction()` methods to pool API: [PR #1148](https://github.com/poolifier/poolifier/pull/1148).
- Stricter worker constructor arguments validation.

## [2.6.45] - 2023-09-17

### Changed

- Disable publication on GitHub packages registry on release until authentication issue is fixed.

### Added

- Add `startWorkers` to pool options to whether start the minimum number of workers at pool initialization or not.
- Add `start()` method to pool API to start the minimum number of workers.
- Add `taskStealing` and `tasksStealingOnPressure` to tasks queue options to whether enable task stealing or not and whether enable tasks stealing under back pressure or not.
- Continuous internal benchmarking: [https://poolifier.github.io/benchmark-results/dev/bench](https://poolifier.github.io/benchmark-results/dev/bench).

## [2.6.44] - 2023-09-08

### Fixed

- Use a dedicated PAT to publish on GitHub packages registry.

### Added

- Publish on GitHub packages registry on release.

### Changed

- Switch from rome to biome: [PR #1128](https://github.com/poolifier/poolifier/pull/1128).

## [2.6.43] - 2023-09-08

### Added

- Publish on GitHub packages registry on release.

### Changed

- Switch from rome to biome: [PR #1128](https://github.com/poolifier/poolifier/pull/1128).

## [2.6.42] - 2023-09-06

### Changed

- Optimize hot code paths implementation: avoid unnecessary branching, add and use optimized helpers (min, max), use reduce() array helper, ...

## [2.6.41] - 2023-09-03

### Changed

- Optimize worker choice strategies implementation.

## [2.6.40] - 2023-09-01

### Fixed

- Do not pre-choose in WRR worker choice strategy to avoid bias.
- Avoid array out of bound in worker choice strategies after worker node removal.

## [2.6.39] - 2023-08-30

### Fixed

- Fix race condition in worker choice strategies at worker node info querying while not yet initialized.

## [2.6.38] - 2023-08-30

### Added

- Bundle typescript types declaration into one file.

### Changed

- Improve interleaved weighted round robin worker choice strategy implementation.

## [2.6.37] - 2023-08-28

### Fixed

- Ensure unused worker usage statistics are deleted at runtime.

### Changed

- Rename worker choice strategy options `choiceRetries` to `retries`.
- Avoid unnecessary branching in worker choice strategies.

## [2.6.36] - 2023-08-27

### Fixed

- Fix pool `execute()` arguments check.

### Changed

- Make continuous tasks stealing algorithm less aggressive.
- Fine tune tasks stealing algorithm under back pressure.

## [2.6.35] - 2023-08-25

### Fixed

- Don't account worker usage statistics for tasks that have failed.
- Fix pool information runtime and wait time median computation.

### Changed

- Update simple moving average implementation to use a circular buffer.
- Update simple moving median implementation to use a circular buffer.
- Account for stolen tasks in worker usage statistics and pool information.

### Added

- Continuous tasks stealing algorithm.

## [2.6.34] - 2023-08-24

### Fixes

- Avoid cascading tasks stealing under back pressure.

### Changed

- Add fastpath to queued tasks rescheduling.

## [2.6.33] - 2023-08-24

### Fixed

- Fix queued tasks rescheduling.

### Changed

- Rename tasks queue options `queueMaxSize` to `size`.

### Added

- Task stealing scheduling algorithm if tasks queueing is enabled.

## [2.6.32] - 2023-08-23

### Fixed

- Ensure no task can be executed when the pool is destroyed.

### Added

- Add `queueMaxSize` option to tasks queue options.
- Add O(1) deque implementation implemented with doubly linked list and use it for tasks queueing.
- Add tasks stealing algorithm when a worker node queue is back pressured if tasks queueing is enabled.

## [2.6.31] - 2023-08-20

### Fixed

- Fix worker choice strategy retries mechanism in some edge cases.

### Changed

- Make orthogonal worker choice strategies tasks distribution and created dynamic worker usage.
- Remove the experimental status of the `LEAST_ELU` worker choice strategy.

## [2.6.30] - 2023-08-19

### Fixed

- Ensure pool event `backPressure` is emitted.
- Ensure pool event `full` is emitted only once.
- Ensure worker node cannot be instantiated without proper arguments.

## [2.6.29] - 2023-08-18

### Fixed

- Fix race condition between readiness and task functions worker message handling at startup.
- Fix duplicate task function worker usage statistics computation per task function.
- Update task function worker usage statistics if and only if there's at least two different task functions.
- Fix race condition at task function worker usage executing task computation leading to negative value.

### Added

- Add back pressure detection on the worker node queue. Event `backPressure` is emitted when all worker node queues are full (worker node queue size >= poolMaxSize^2).
- Use back pressure detection in worker choice strategies.
- Add worker choice strategies retries mechanism if no worker is eligible.

## [2.6.28] - 2023-08-16

### Fixed

- Ensure pool workers are properly initialized.

### Added

- HTTP server pool examples: express-cluster, express-hybrid.

### Changed

- Remove now useless branching in worker hot code path.

## [2.6.27] - 2023-08-15

### Fixed

- Add `KillHandler` type definition to exported types.

### Added

- Add `destroy` event to pool API.

## [2.6.26] - 2023-08-15

### Added

- Add kill handler to worker options allowing to execute custom code when worker is killed.
- Add `listTaskFunctions()` method to pool API.
- SMTP client pool example: nodemailer.

## [2.6.25] - 2023-08-13

### Added

- HTTP server pool examples: fastify-cluster, fastify-hybrid.
- WebSocket server pool examples: ws-cluster, ws-hybrid.

## [2.6.24] - 2023-08-12

### Added

- Add array of transferable objects to the `execute()` method arguments.
- WebSocket server pool examples: ws-worker_threads.

## [2.6.23] - 2023-08-11

### Fixed

- Fix pool busyness semantic when tasks queueing is enabled: the pool is busy when the number of executing tasks on each worker has reached the maximum tasks concurrency per worker.

### Added

- HTTP client pool examples: fetch, node-fetch and axios with multiple task functions.
- HTTP server pool examples: express-worker_threads, fastify-worker_threads.

## [2.6.22] - 2023-08-10

### Fixed

- Add missing `types` field to package.json `exports`.

### Changed

- Structure markdown documentation (PR #811).

## [2.6.21] - 2023-08-03

### Changed

- Improve code documentation.
- Code refactoring and cleanup for better maintainability and readability.

## [2.6.20] - 2023-07-21

### Fixed

- Fix queued tasks redistribution on error task execution starvation.
- Ensure tasks queueing per worker condition is untangled from the pool busyness semantic.

### Changed

- Drastically reduce lookups by worker in the worker nodes.

## [2.6.19] - 2023-07-20

### Added

- Dedicated internal communication channel for worker_threads pools.

## [2.6.18] - 2023-07-19

### Changed

- Code refactoring and cleanup for better maintainability and readability. Bundle size is a bit smaller.

## [2.6.17] - 2023-07-16

### Added

- Add `listTaskFunctions()` method to worker API.

## [2.6.16] - 2023-07-12

### Fixed

- Fix pool startup detection.
- Fix worker task functions handling.

## [2.6.15] - 2023-07-11

### Added

- Take into account worker node readiness in worker choice strategies.

## [2.6.14] - 2023-07-10

### Fixed

- Fix task function statistics tracking.

## [2.6.13] - 2023-07-10

### Added

- Add per task function statistics tracking.
- Add public methods to manipulate the worker task functions at runtime.

## [2.6.12] - 2023-07-09

### Fixed

- Workaround import issue with `node:os` module in node 16.x.x.

## [2.6.11] - 2023-07-09

### Fixed

- Fix pool readiness semantic.

## [2.6.10] - 2023-07-08

### Fixed

- Ensure workers are not recreated on error at pool startup.

### Added

- Add `ready` and `strategy` fields to pool information.
- Add pool event `ready` to notify when the number of workers created in the pool has reached the maximum size expected and are ready.
- Add dynamic pool sizing checks.

## [2.6.9] - 2023-07-07

### Fixed

- Recreate the right worker type on uncaught exception.

### Added

- Add minimum and maximum to internal measurement statistics.
- Add `runTime` and `waitTime` to pool information.
- Check worker inactive time only on dynamic worker.

## [2.6.8] - 2023-07-03

### Fixed

- Brown paper bag release to fix version handling in pool information.

## [2.6.7] - 2023-07-03

### Fixed

- Ensure worker queued tasks at error are reassigned to other pool workers.

### Added

- Add pool `utilization` ratio to pool information.
- Add `version` to pool information.
- Add worker information to worker nodes.

## [2.6.6] - 2023-07-01

### Added

- Add safe helper `availableParallelism()` to help sizing the pool.

### Fixed

- Ensure message handler is only registered in worker.

## [2.6.5] - 2023-06-27

### Known issues

- Cluster pools tasks execution are not working by using ESM files extension: https://github.com/poolifier/poolifier/issues/782

### Fixed

- Artificial version bump to 2.6.5 to workaround publication issue.
- Ensure cluster pool `destroy()` gracefully shutdowns worker's server.
- Ensure pool event is emitted before task error promise rejection.
- Fix queued tasks count computation.

### Removed

- Remove unneeded worker_threads worker `MessageChannel` internal usage for IPC.

## [2.6.4] - 2023-06-27

### Known issues

- Cluster pools tasks execution are not working by using ESM files extension: https://github.com/poolifier/poolifier/issues/782

### Fixed

- Ensure cluster pool `destroy()` gracefully shutdowns worker's server.
- Ensure pool event is emitted before task error promise rejection.
- Fix queued tasks count computation.

### Removed

- Remove unneeded worker_threads worker `MessageChannel` internal usage for IPC.

## [2.6.3] - 2023-06-19

### Fixed

- Ensure no tasks are queued when trying to soft kill a dynamic worker.
- Update strategies internals after statistics computation.

### Changed

- Optimize O(1) queue implementation.

## [2.6.2] - 2023-06-12

### Fixed

- Fix new worker use after creation in dynamic pool given the current worker choice strategy.

## [2.6.1] - 2023-06-10

### Added

- Add worker choice strategy documentation: [README.md](./docs/worker-choice-strategies.md).

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
- Add `worker_threads` options to thread pool options.

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

- Fix typescript type definition for task function: ensure the input data is optional.
- Fix typescript type definition for pool execute(): ensure the input data is optional.

## [2.4.9] - 2023-04-15

### Added

- Add tasks queue enablement runtime setter to pool.
- Add tasks queue options runtime setter to pool.
- Add worker choice strategy options runtime setter to pool.

### Changed

- Remove the tasks queuing experimental status.

### Fixed

- Fix task function type definition and validation.
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
- Update benchmark versus external threads pools.
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
- Update benchmark versus external threads pools.

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

- Fix package.json `exports` syntax for ESM and CommonJS.

### Changed

- Permit SemVer pre-release publication.

## [2.3.10-2] - 2023-03-18

### Fixed

- Fix package.json `exports` syntax for ESM and CommonJS.

## [2.3.10-1] - 2023-03-18

### Changed

- Permit SemVer pre-release publication.

## [2.3.10-0] - 2023-03-18

### Fixed

- Fix package.json `exports` syntax for ESM and CommonJS.

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
- Update benchmark versus external pools results with latest version.

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

- Support only Node.js version 16.x.x for cluster pool: upstream cluster API have changed on that version.

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

For cluster worker and worker-thread pools, you can now only send and receive structured-cloneable data.  
_This is not a limitation by poolifier but Node.js._

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
