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
const DynamicThreadPool = require('poolifier/lib/dynamic')
// After
const { DynamicThreadPool } = require('poolifier/lib/dynamic')
```

But you should always prefer just using

```js
const { DynamicThreadPool } = require('poolifier')
```

#### New type definitions for input data and response

For cluster and thread pools, you can now only send and receive serializable `JSON` data.  
_This is not a limitation by poolifier but NodeJS._

#### Public properties renaming

- Thread Pool's `numWorkers` is now `numberOfWorkers`
- Thread Pool's `nextWorker` is now `nextWorkerIndex`

#### Internal (protected) properties and methods renaming

These properties are not intended for end users

- `id` => `nextMessageId`

These methods are not intended for end users

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
