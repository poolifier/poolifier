# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2021-16-03

### Bug fixes

- Check if pool options are properly set.
- `busy` event is emitted on all pool types.

## [2.0.0] - 2021-01-03

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

## [1.1.0] - 2020-21-05

### Added

- ThreadWorker support async functions as option
- Various external library patches

## [1.0.0] - 2020-24-01

### Added

- FixedThreadPool implementation
- DynamicThreadPool implementation
- WorkerThread implementation to improve developer experience
