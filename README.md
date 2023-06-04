<div align="center">
  <img src="./images/logo.png" width="340px" height="266px"/>
</div>

<h2 align="center">Node Thread Pool and Cluster Pool :arrow_double_up: :on:</h2>

<p align="center">
  <a href="https://www.npmjs.com/package/poolifier">
    <img alt="Weekly Downloads" src="https://img.shields.io/npm/dw/poolifier"></a>
  <a href="https://github.com/poolifier/poolifier/actions/workflows/ci.yml">
    <img alt="Actions Status" src="https://github.com/poolifier/poolifier/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://sonarcloud.io/dashboard?id=pioardi_poolifier">
    <img alt="Quality Gate Status" src="https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=alert_status"></a>
  <a href="https://sonarcloud.io/dashboard?id=pioardi_poolifier">
    <img alt="Code Coverage" src="https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=coverage"></a>
  <a href="https://standardjs.com">
    <img alt="Javascript Standard Style Guide" src="https://img.shields.io/badge/code_style-standard-brightgreen.svg"></a>
  <a href="https://gitter.im/poolifier/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge">
    <img alt="Gitter chat" src="https://badges.gitter.im/poolifier/community.svg"></a>
  <a href="https://opencollective.com/poolifier">
    <img alt="Open Collective" src="https://opencollective.com/poolifier/tiers/badge.svg"></a>
  <a href="https://badgen.net/badge/Dependabot/enabled/green?icon=dependabot">
    <img alt="Dependabot" src="https://badgen.net/badge/Dependabot/enabled/green?icon=dependabot"></a>
  <a href="http://makeapullrequest.com">
    <img alt="PR Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square"></a>
  <a href="https://img.shields.io/static/v1?label=dependencies&message=no%20dependencies&color=brightgreen">
    <img alt="No dependencies" src="https://img.shields.io/static/v1?label=dependencies&message=no%20dependencies&color=brightgreen"></a>
</p>

## Why Poolifier?

Poolifier is used to perform CPU intensive and I/O intensive tasks on nodejs servers, it implements worker pools using [worker-threads](https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads) and cluster pools using [Node.js cluster](https://nodejs.org/api/cluster.html) modules.  
With poolifier you can improve your **performance** and resolve problems related to the event loop.  
Moreover you can execute your tasks using an API designed to improve the **developer experience**.  
Please consult our [general guidelines](#general-guidance).

- Performance :racehorse: [benchmarks](./benchmarks/README.md)
- Security :bank: :cop: [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=security_rating)](https://sonarcloud.io/dashboard?id=pioardi_poolifier) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
- Easy to use :couple:
- Dynamic pool size :white_check_mark:
- Easy switch from a pool to another :white_check_mark:
- No runtime dependencies :white_check_mark:
- Proper async integration with node async hooks :white_check_mark:
- Support for worker threads and cluster node modules :white_check_mark:
- Support sync and async tasks :white_check_mark:
- Tasks distribution strategies :white_check_mark:
- General guidance on pools to use :white_check_mark:
- Widely tested :white_check_mark:
- Error handling out of the box :white_check_mark:
- Active community :white_check_mark:
- Code quality :octocat: [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=bugs)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=code_smells)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=sqale_index)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)

## Contents

<h3 align="center">
  <a href="#overview">Overview</a>
  <span> · </span>
  <a href="#installation">Installation</a>
  <span> · </span>
  <a href="#usage">Usage</a>
  <span> · </span>
  <a href="#node-versions">Node versions</a>
  <span> · </span>
  <a href="#api">API</a>
  <span> · </span>
  <a href="#general-guidance">General guidance</a>
  <span> · </span>
  <a href="#contribute">Contribute</a>
  <span> · </span>
  <a href="#team">Team</a>
  <span> · </span>
  <a href="#license">License</a>
</h3>

## Overview

Node pool contains two [worker-threads](https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads)/[cluster worker](https://nodejs.org/api/cluster.html#cluster_class_worker) pool implementations, you don't have to deal with worker-threads/cluster worker complexity.  
The first implementation is a static worker pool, with a defined number of workers that are started at creation time and will be reused.  
The second implementation is a dynamic worker pool with a number of worker started at creation time (these workers will be always active and reused) and other workers created when the load will increase (with an upper limit, these workers will be reused when active), the new created workers will be stopped after a configurable period of inactivity.  
You have to implement your worker extending the ThreadWorker or ClusterWorker class.

## Installation

```shell
npm install poolifier --save
```

## Usage

You can implement a worker-threads worker in a simple way by extending the class ThreadWorker:

```js
'use strict'
const { ThreadWorker } = require('poolifier')

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
'use strict'
const { DynamicThreadPool, FixedThreadPool, PoolEvents } = require('poolifier')

// a fixed worker-threads pool
const pool = new FixedThreadPool(15,
  './yourWorker.js',
  { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })

pool.emitter.on(PoolEvents.busy, () => console.log('Pool is busy'))

// or a dynamic worker-threads pool
const pool = new DynamicThreadPool(10, 100,
  './yourWorker.js',
  { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })

pool.emitter.on(PoolEvents.full, () => console.log('Pool is full'))
pool.emitter.on(PoolEvents.busy, () => console.log('Pool is busy'))

// the execute method signature is the same for both implementations,
// so you can easy switch from one to another
pool.execute({}).then(res => {
  console.log(res)
}).catch ....

```

You can do the same with the classes ClusterWorker, FixedClusterPool and DynamicClusterPool.

**See examples folder for more details (in particular if you want to use a pool with [multiple worker functions](./examples/multiFunctionExample.js))**.

Remember that workers can only send and receive serializable data.

## Node versions

Node versions >= 16.14.x are supported.

## [API](https://poolifier.github.io/poolifier/)

### `pool = new FixedThreadPool/FixedClusterPool(numberOfThreads/numberOfWorkers, filePath, opts)`

`numberOfThreads/numberOfWorkers` (mandatory) Number of workers for this pool  
`filePath` (mandatory) Path to a file with a worker implementation  
`opts` (optional) An object with these properties:

- `messageHandler` (optional) - A function that will listen for message event on each worker
- `errorHandler` (optional) - A function that will listen for error event on each worker
- `onlineHandler` (optional) - A function that will listen for online event on each worker
- `exitHandler` (optional) - A function that will listen for exit event on each worker
- `workerChoiceStrategy` (optional) - The worker choice strategy to use in this pool:

  - `WorkerChoiceStrategies.ROUND_ROBIN`: Submit tasks to worker in a round robbin fashion
  - `WorkerChoiceStrategies.LEAST_USED`: Submit tasks to the least used worker
  - `WorkerChoiceStrategies.LEAST_BUSY`: Submit tasks to the least busy worker
  - `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`: Submit tasks to worker using a weighted round robin scheduling algorithm based on tasks execution time
  - `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN`: Submit tasks to worker using an interleaved weighted round robin scheduling algorithm based on tasks execution time (experimental)
  - `WorkerChoiceStrategies.FAIR_SHARE`: Submit tasks to worker using a fair share tasks scheduling algorithm based on tasks execution time

  `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN` and `WorkerChoiceStrategies.FAIR_SHARE` strategies are targeted to heavy and long tasks.  
  Default: `WorkerChoiceStrategies.ROUND_ROBIN`

- `workerChoiceStrategyOptions` (optional) - The worker choice strategy options object to use in this pool.  
  Properties:

  - `medRunTime` (optional) - Use the tasks median runtime instead of the tasks average runtime in worker choice strategies.
  - `weights` (optional) - The worker weights to use in the weighted round robin worker choice strategy: `{ 0: 200, 1: 300, ..., n: 100 }`

  Default: `{ medRunTime: false }`

- `restartWorkerOnError` (optional) - Restart worker on uncaught error in this pool.  
  Default: true
- `enableEvents` (optional) - Events emission enablement in this pool.  
  Default: true
- `enableTasksQueue` (optional) - Tasks queue per worker enablement in this pool.  
  Default: false

- `tasksQueueOptions` (optional) - The worker tasks queue options object to use in this pool.  
  Properties:

  - `concurrency` (optional) - The maximum number of tasks that can be executed concurrently on a worker.

  Default: `{ concurrency: 1 }`

### `pool = new DynamicThreadPool/DynamicClusterPool(min, max, filePath, opts)`

`min` (mandatory) Same as FixedThreadPool/FixedClusterPool numberOfThreads/numberOfWorkers, this number of workers will be always active  
`max` (mandatory) Max number of workers that this pool can contain, the new created workers will die after a threshold (default is 1 minute, you can override it in your worker implementation).  
`filePath` (mandatory) Same as FixedThreadPool/FixedClusterPool  
`opts` (optional) Same as FixedThreadPool/FixedClusterPool

### `pool.execute(data)`

`data` (optional) An object that you want to pass to your worker implementation  
This method is available on both pool implementations and returns a promise.

### `pool.destroy()`

Destroy method is available on both pool implementations.  
This method will call the terminate method on each worker.

### `class YourWorker extends ThreadWorker/ClusterWorker`

`taskFunctions` (mandatory) The task function(s) that you want to execute on the worker  
`opts` (optional) An object with these properties:

- `maxInactiveTime` (optional) - Max time to wait tasks to work on in milliseconds, after this period the new worker will die.  
  The last active time of your worker unit will be updated when a task is submitted to a worker or when a worker terminate a task.  
  If `killBehavior` is set to `KillBehaviors.HARD` this value represents also the timeout for the tasks that you submit to the pool, when this timeout expires your tasks is interrupted and the worker is killed if is not part of the minimum size of the pool.  
  If `killBehavior` is set to `KillBehaviors.SOFT` your tasks have no timeout and your workers will not be terminated until your task is completed.  
  Default: 60000

- `killBehavior` (optional) - Dictates if your async unit (worker/process) will be deleted in case that a task is active on it.  
  **KillBehaviors.SOFT**: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still running, then the worker **won't** be deleted.  
  **KillBehaviors.HARD**: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still running, then the worker will be deleted.  
  This option only apply to the newly created workers.  
  Default: `KillBehaviors.SOFT`

## General guidance

Performance is one of the main target of these worker pool implementations, we want to have a strong focus on this.  
We already have a bench folder where you can find some comparisons.

### Internal Node.js thread pool

Before to jump into each poolifier pool type, let highlight that **Node.js comes with a thread pool already**, the libuv thread pool where some particular tasks already run by default.  
Please take a look at [which tasks run on the libuv thread pool](https://nodejs.org/en/docs/guides/dont-block-the-event-loop/#what-code-runs-on-the-worker-pool).

**If your task runs on libuv thread pool**, you can try to:

- Tune the libuv thread pool size setting the [UV_THREADPOOL_SIZE](https://nodejs.org/api/cli.html#cli_uv_threadpool_size_size).

and/or

- Use poolifier cluster pool that spawning child processes will also increase the number of libuv threads since that any new child process comes with a separated libuv thread pool. **More threads does not mean more fast, so please tune your application**.

### Cluster vs Threads worker pools

**If your task does not run into libuv thread pool** and is CPU intensive then poolifier **thread pools** (FixedThreadPool and DynamicThreadPool) are suggested to run CPU intensive tasks, you can still run I/O intensive tasks into thread pools, but performance enhancement is expected to be minimal.  
Thread pools are built on top of Node.js [worker-threads](https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads) module.

**If your task does not run into libuv thread pool** and is I/O intensive then poolifier **cluster pools** (FixedClusterPool and DynamicClusterPool) are suggested to run I/O intensive tasks, again you can still run CPU intensive tasks into cluster pools, but performance enhancement is expected to be minimal.  
Consider that by default Node.js already has great performance for I/O tasks (asynchronous I/O).  
Cluster pools are built on top of Node.js [cluster](https://nodejs.org/api/cluster.html) module.

If your task contains code that runs on libuv plus code that is CPU intensive or I/O intensive you either split it either combine more strategies (i.e. tune the number of libuv threads and use cluster/thread pools).  
But in general, **always profile your application**.

### Fixed vs Dynamic pools

To choose your pool consider that with a FixedThreadPool/FixedClusterPool or a DynamicThreadPool/DynamicClusterPool (in this case is important the min parameter passed to the constructor) your application memory footprint will increase.  
Increasing the memory footprint, your application will be ready to accept more tasks, but during idle time your application will consume more memory.  
One good choose from my point of view is to profile your application using Fixed/Dynamic worker pool, and to see your application metrics when you increase/decrease the num of workers.  
For example you could keep the memory footprint low choosing a DynamicThreadPool/DynamicClusterPool with 5 workers, and allow to create new workers until 50/100 when needed, this is the advantage to use the DynamicThreadPool/DynamicClusterPool.  
But in general, **always profile your application**.

## Contribute

Choose your task here [2.4.x](https://github.com/orgs/poolifier/projects/1), propose an idea, a fix, an improvement.

See [CONTRIBUTING](CONTRIBUTING.md) guidelines.

## Team

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->

**Creator/Owner:**

- [**Alessandro Pio Ardizio**](https://github.com/pioardi)

**_Contributors_**

- [**Shinigami92**](https://github.com/Shinigami92)
- [**Jérôme Benoit**](https://github.com/jerome-benoit)

## License

[MIT](./LICENSE)
