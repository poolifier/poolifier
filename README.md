<div align="center">
  <img src="./images/logo.png" width="340px" height="266px"/>
</div>

<div align="center">

# Node.js Worker_Threads and Cluster Worker Pool

</div>

<div align="center">

[![GitHub commit activity (master)](https://img.shields.io/github/commit-activity/m/poolifier/poolifier/master?color=brightgreen&logo=github)](https://github.com/poolifier/poolifier/graphs/commit-activity)
[![Npm Version](https://badgen.net/npm/v/poolifier?icon=npm)](https://www.npmjs.com/package/poolifier)
[![Npm Weekly Downloads](https://badgen.net/npm/dw/poolifier?icon=npm)](https://www.npmjs.com/package/poolifier)
[![JSR Version](https://jsr.io/badges/@poolifier/poolifier)](https://jsr.io/@poolifier/poolifier)
[![CI Workflow](https://github.com/poolifier/poolifier/actions/workflows/ci.yml/badge.svg)](https://github.com/poolifier/poolifier/actions/workflows/ci.yml)
[![Code Coverage](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=coverage)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=alert_status)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
[![Javascript Standard Style Guide](<https://badgen.net/static/code style/standard/green>)](https://standardjs.com)
[![Discord](https://badgen.net/discord/online-members/vXxZhyb3b6?icon=discord&label=discord&color=green)](https://discord.gg/vXxZhyb3b6)
[![Open Collective](https://opencollective.com/poolifier/tiers/badge.svg)](https://opencollective.com/poolifier)
[![PRs Welcome](https://badgen.net/static/PRs/welcome/green)](https://makeapullrequest.com)
[![No Dependencies](<https://badgen.net/static/dependencies/no dependencies/green>)](<https://badgen.net/static/dependencies/no dependencies/green>)

</div>

## Why Poolifier?

Poolifier is used to perform CPU and/or I/O intensive tasks on Node.js servers, it implements worker pools using [worker_threads](https://nodejs.org/api/worker_threads.html) and [cluster](https://nodejs.org/api/cluster.html) Node.js modules.  
With poolifier you can improve your **performance** and resolve problems related to the event loop.  
Moreover you can execute your tasks using an API designed to improve the **developer experience**.  
Please consult our [general guidelines](#general-guidelines).

- Easy to use :white_check_mark:
- Fixed and dynamic pool size :white_check_mark:
- Easy switch from a pool type to another :white_check_mark:
- Performance [benchmarks](./benchmarks/README.md) :white_check_mark:
- No runtime dependencies :white_check_mark:
- Proper integration with Node.js [async_hooks](https://nodejs.org/api/async_hooks.html) :white_check_mark:
- Support for CommonJS, ESM and TypeScript :white_check_mark:
- Support for [worker_threads](https://nodejs.org/api/worker_threads.html) and [cluster](https://nodejs.org/api/cluster.html) Node.js modules :white_check_mark:
- Support for multiple task functions :white_check_mark:
- Support for task functions [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) operations at runtime :white_check_mark:
- Support for sync and async task functions :white_check_mark:
- Tasks distribution strategies :white_check_mark:
- Lockless tasks queueing :white_check_mark:
- Queued tasks rescheduling:
  - Task stealing on idle :white_check_mark:
  - Tasks stealing under back pressure :white_check_mark:
  - Tasks redistribution on worker error :white_check_mark:
- General guidelines on pool choice :white_check_mark:
- Error handling out of the box :white_check_mark:
- Widely tested :white_check_mark:
- Active community :white_check_mark:
- Code quality [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=bugs)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
  [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=code_smells)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
  [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
  [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
  [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
  [![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=sqale_index)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)
- Code security [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=security_rating)](https://sonarcloud.io/dashboard?id=poolifier_poolifier) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=poolifier_poolifier)

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [Node.js versions](#nodejs-versions)
- [API](#api)
- [General guidelines](#general-guidelines)
- [Worker choice strategies](#worker-choice-strategies)
- [Contribute](#contribute)
- [Team](#team)
- [License](#license)

## Overview

Poolifier contains two [worker_threads](https://nodejs.org/api/worker_threads.html#class-worker)/[cluster](https://nodejs.org/api/cluster.html#cluster_class_worker) worker pool implementations, you don't have to deal with [worker_threads](https://nodejs.org/api/worker_threads.html)/[cluster](https://nodejs.org/api/cluster.html) complexity.  
The first implementation is a fixed worker pool, with a defined number of workers that are started at creation time and will be reused.  
The second implementation is a dynamic worker pool, with a number of worker started at creation time (these workers will be always active and reused) and other workers created when the load will increase (with an upper limit, these workers will be reused when active), the newly created workers will be stopped after a configurable period of inactivity.  
You have to implement your worker by extending the _ThreadWorker_ or _ClusterWorker_ class.

## Installation

### npm

```shell
npm install poolifier --save
```

### jsr

```shell
npx jsr add @poolifier/poolifier
```

## Usage

You can implement a poolifier [worker_threads](https://nodejs.org/api/worker_threads.html#class-worker) worker in a simple way by extending the class _ThreadWorker_:

```js
import { ThreadWorker } from 'poolifier'

function yourFunction(data) {
  // this will be executed in the worker thread,
  // the data will be received by using the execute method
  return { ok: 1 }
}

module.exports = new ThreadWorker(yourFunction, {
  maxInactiveTime: 60000
})
```

Instantiate your pool based on your needs :

```js
import { DynamicThreadPool, FixedThreadPool, PoolEvents, availableParallelism } from 'poolifier'

// a fixed worker_threads pool
const pool = new FixedThreadPool(availableParallelism(), './yourWorker.js', {
  onlineHandler: () => console.info('worker is online'),
  errorHandler: e => console.error(e)
})

pool.emitter?.on(PoolEvents.ready, () => console.info('Pool is ready'))
pool.emitter?.on(PoolEvents.busy, () => console.info('Pool is busy'))

// or a dynamic worker_threads pool
const pool = new DynamicThreadPool(Math.floor(availableParallelism() / 2), availableParallelism(), './yourWorker.js', {
  onlineHandler: () => console.info('worker is online'),
  errorHandler: e => console.error(e)
})

pool.emitter?.on(PoolEvents.full, () => console.info('Pool is full'))
pool.emitter?.on(PoolEvents.ready, () => console.info('Pool is ready'))
pool.emitter?.on(PoolEvents.busy, () => console.info('Pool is busy'))

// the execute method signature is the same for both implementations,
// so you can easily switch from one to another
pool
  .execute()
  .then(res => {
    console.info(res)
  })
  .catch(err => {
    console.error(err)
  })
```

You can do the same with the classes _ClusterWorker_, _FixedClusterPool_ and _DynamicClusterPool_.

**See [examples](./examples/) for more details**:

- [Javascript](./examples/javascript/)
- [Typescript](./examples/typescript/)
  - [HTTP client pool](./examples/typescript/http-client-pool/)
  - [SMTP client pool](./examples/typescript/smtp-client-pool/)
  - [HTTP server pool](./examples/typescript/http-server-pool/)
    - [Express worker_threads pool](./examples/typescript/http-server-pool/express-worker_threads/)
    - [Express cluster pool](./examples/typescript/http-server-pool/express-cluster/)
    - [Express hybrid pool](./examples/typescript/http-server-pool/express-hybrid/)
    - [Fastify worker_threads pool](./examples/typescript/http-server-pool/fastify-worker_threads/)
    - [Fastify cluster pool](./examples/typescript/http-server-pool/fastify-cluster/)
    - [Fastify hybrid pool](./examples/typescript/http-server-pool/fastify-hybrid/)
  - [WebSocket server pool](./examples/typescript/websocket-server-pool/)
    - [ws worker_threads pool](./examples/typescript/websocket-server-pool/ws-worker_threads/)
    - [ws cluster pool](./examples/typescript/websocket-server-pool/ws-cluster/)
    - [ws hybrid pool](./examples/typescript/websocket-server-pool/ws-hybrid/)

Remember that workers can only send and receive structured-cloneable data.

## Node.js versions

Node.js versions >= 18.x.x are supported.

## [API](./docs/api.md)

## [General guidelines](./docs/general-guidelines.md)

## [Worker choice strategies](./docs/worker-choice-strategies.md)

## Contribute

Choose your task [here](https://github.com/orgs/poolifier/projects/1), propose an idea, a fix, an improvement.

See [CONTRIBUTING](./CONTRIBUTING.md) guidelines.

## Team

**Creator/Owner:**

- [**Alessandro Pio Ardizio**](https://github.com/pioardi)

**Maintainers:**

- [**Jérôme Benoit**](https://github.com/jerome-benoit)

**Contributors:**

- [**Shinigami92**](https://github.com/Shinigami92)

## License

[MIT](./LICENSE)
