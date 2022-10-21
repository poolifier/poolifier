# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
