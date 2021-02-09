# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - not released yet

### Breaking Changes

We changed some internal structures, but you shouldn't be too affected by them as these are internal changes.

#### New `export` strategy

```js
// Before
const DynamicThreadPool = require("poolifier/lib/dynamic");
// After
const { DynamicThreadPool } = require("poolifier/lib/dynamic");
```

But you should always prefer just using

```js
const { DynamicThreadPool } = require("poolifier");
```

#### Internal (protected) methods has renamed

Those methods are not intended to be used from final users

- `_chooseWorker` => `chooseWorker`
- `_newWorker` => `newWorker`
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
