<div align="center">
  <img src="./images/logo.png" width="340px" height="266px"/>
</div>

<h2 align="center">Node Thread Pool and Cluster Pool :arrow_double_up: :on:</h2>

<p align="center">
  <a href="https://github.com/poolifier/poolifier/graphs/commit-activity">
    <img alt="GitHub commit activity (master)" src="https://img.shields.io/github/commit-activity/m/poolifier/poolifier/master"></a>
  <a href="https://www.npmjs.com/package/poolifier">
    <img alt="Weekly Downloads" src="https://img.shields.io/npm/dw/poolifier"></a>
  <a href="https://github.com/poolifier/poolifier/actions/workflows/ci.yml">
    <img alt="Actions Status" src="https://github.com/poolifier/poolifier/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://sonarcloud.io/dashboard?id=pioardi_poolifier">
    <img alt="Code Coverage" src="https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=coverage"></a>
  <a href="https://sonarcloud.io/dashboard?id=pioardi_poolifier">
    <img alt="Quality Gate Status" src="https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=alert_status"></a>
  <a href="https://standardjs.com">
    <img alt="Javascript Standard Style Guide" src="https://img.shields.io/badge/code_style-standard-brightgreen.svg"></a>
  <a href="https://gitter.im/poolifier/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge">
    <img alt="Gitter chat" src="https://badges.gitter.im/poolifier/community.svg"></a>
  <a href="https://opencollective.com/poolifier">
    <img alt="Open Collective" src="https://opencollective.com/poolifier/tiers/badge.svg"></a>
  <a href="http://makeapullrequest.com">
    <img alt="PR Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square"></a>
  <a href="https://img.shields.io/static/v1?label=dependencies&message=no%20dependencies&color=brightgreen">
    <img alt="No dependencies" src="https://img.shields.io/static/v1?label=dependencies&message=no%20dependencies&color=brightgreen"></a>
</p>

## Why Poolifier?

Poolifier is used to perform CPU intensive and I/O intensive tasks on nodejs servers, it implements worker pools using [worker_threads](https://nodejs.org/api/worker_threads.html) and [cluster](https://nodejs.org/api/cluster.html) Node.js modules.  
With poolifier you can improve your **performance** and resolve problems related to the event loop.  
Moreover you can execute your tasks using an API designed to improve the **developer experience**.  
Please consult our [general guidelines](#general-guidance).

- Easy to use :white_check_mark:
- Performance [benchmarks](./benchmarks/README.md) :white_check_mark:
- Dynamic pool size :white_check_mark:
- Easy switch from a pool to another :white_check_mark:
- No runtime dependencies :white_check_mark:
- Proper async integration with node async hooks :white_check_mark:
- Support CommonJS, ESM, and TypeScript :white_check_mark:
- Support for worker_threads and cluster node modules :white_check_mark:
- Support sync and async tasks :white_check_mark:
- Tasks distribution strategies :white_check_mark:
- General guidance on pool choice :white_check_mark:
- Widely tested :white_check_mark:
- Error handling out of the box :white_check_mark:
- Active community :white_check_mark:
- Code quality [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=bugs)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=code_smells)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
  [![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=sqale_index)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)
- Code security [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=security_rating)](https://sonarcloud.io/dashboard?id=pioardi_poolifier) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=pioardi_poolifier&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=pioardi_poolifier)

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

Poolifier contains two [worker_threads](https://nodejs.org/api/worker_threads.html#class-worker)/[cluster](https://nodejs.org/api/cluster.html#cluster_class_worker) worker pool implementations, you don't have to deal with worker_threads/cluster complexity.  
The first implementation is a static worker pool, with a defined number of workers that are started at creation time and will be reused.  
The second implementation is a dynamic worker pool with a number of worker started at creation time (these workers will be always active and reused) and other workers created when the load will increase (with an upper limit, these workers will be reused when active), the new created workers will be stopped after a configurable period of inactivity.  
You have to implement your worker by extending the ThreadWorker or ClusterWorker class.

## Installation

```shell
npm install poolifier --save
```

## Usage

You can implement a worker_threads worker in a simple way by extending the class ThreadWorker:

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
const { DynamicThreadPool, FixedThreadPool, PoolEvents, availableParallelism } = require('poolifier')

// a fixed worker_threads pool
const pool = new FixedThreadPool(availableParallelism(), './yourWorker.js', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.info('worker is online')
})

pool.emitter.on(PoolEvents.ready, () => console.info('Pool is ready'))
pool.emitter.on(PoolEvents.busy, () => console.info('Pool is busy'))

// or a dynamic worker_threads pool
const pool = new DynamicThreadPool(Math.floor(availableParallelism() / 2), availableParallelism(), './yourWorker.js', {
  errorHandler: e => console.error(e),
  onlineHandler: () => console.info('worker is online')
})

pool.emitter.on(PoolEvents.full, () => console.info('Pool is full'))
pool.emitter.on(PoolEvents.ready, () => console.info('Pool is ready'))
pool.emitter.on(PoolEvents.busy, () => console.info('Pool is busy'))

// the execute method signature is the same for both implementations,
// so you can easy switch from one to another
pool
  .execute({})
  .then(res => {
    console.info(res)
  })
  .catch(err => {
    console.error(err)
  })
```

You can do the same with the classes ClusterWorker, FixedClusterPool and DynamicClusterPool.

**See [examples](./examples/) folder for more details (in particular if you want to use a pool with [multiple worker functions](./examples/multiFunctionExample.js))**.

Remember that workers can only send and receive structured-cloneable data.

## Node versions

Node versions >= 16.14.x are supported.

## [API](https://poolifier.github.io/poolifier/)

### `PoolOptions`

An object with these properties:

- `messageHandler` (optional) - A function that will listen for message event on each worker
- `errorHandler` (optional) - A function that will listen for error event on each worker
- `onlineHandler` (optional) - A function that will listen for online event on each worker
- `exitHandler` (optional) - A function that will listen for exit event on each worker
- `workerChoiceStrategy` (optional) - The worker choice strategy to use in this pool:

  - `WorkerChoiceStrategies.ROUND_ROBIN`: Submit tasks to worker in a round robin fashion
  - `WorkerChoiceStrategies.LEAST_USED`: Submit tasks to the worker with the minimum number of executed, executing and queued tasks
  - `WorkerChoiceStrategies.LEAST_BUSY`: Submit tasks to the worker with the minimum tasks total execution and wait time
  - `WorkerChoiceStrategies.LEAST_ELU`: Submit tasks to the worker with the minimum event loop utilization (ELU) (experimental)
  - `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`: Submit tasks to worker by using a [weighted round robin scheduling algorithm](./src/pools/selection-strategies/README.md#weighted-round-robin) based on tasks execution time
  - `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN`: Submit tasks to worker by using an [interleaved weighted round robin scheduling algorithm](./src/pools/selection-strategies/README.md#interleaved-weighted-round-robin) based on tasks execution time(experimental)
  - `WorkerChoiceStrategies.FAIR_SHARE`: Submit tasks to worker by using a [fair share scheduling algorithm](./src/pools/selection-strategies/README.md#fair-share) based on tasks execution time (the default) or ELU active time

  `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`, `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN` and `WorkerChoiceStrategies.FAIR_SHARE` strategies are targeted to heavy and long tasks.  
  Default: `WorkerChoiceStrategies.ROUND_ROBIN`

- `workerChoiceStrategyOptions` (optional) - The worker choice strategy options object to use in this pool.  
  Properties:

  - `measurement` (optional) - The measurement to use in worker choice strategies: `runTime`, `waitTime` or `elu`.
  - `runTime` (optional) - Use the tasks [median](./src/pools/selection-strategies/README.md#median) runtime instead of the tasks average runtime in worker choice strategies.
  - `waitTime` (optional) - Use the tasks [median](./src/pools/selection-strategies/README.md#median) wait time instead of the tasks average wait time in worker choice strategies.
  - `elu` (optional) - Use the tasks [median](./src/pools/selection-strategies/README.md#median) ELU instead of the tasks average ELU in worker choice strategies.
  - `weights` (optional) - The worker weights to use in weighted round robin worker choice strategies: `{ 0: 200, 1: 300, ..., n: 100 }`.

  Default: `{ runTime: { median: false }, waitTime: { median: false }, elu: { median: false } }`

- `restartWorkerOnError` (optional) - Restart worker on uncaught error in this pool.  
  Default: `true`
- `enableEvents` (optional) - Events emission enablement in this pool.  
  Default: `true`
- `enableTasksQueue` (optional) - Tasks queue per worker enablement in this pool.  
  Default: `false`

- `tasksQueueOptions` (optional) - The worker tasks queue options object to use in this pool.  
  Properties:

  - `concurrency` (optional) - The maximum number of tasks that can be executed concurrently on a worker.

  Default: `{ concurrency: 1 }`

#### `ThreadPoolOptions extends PoolOptions`

- `workerOptions` (optional) - An object with the worker options to pass to worker. See [worker_threads](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for more details.

#### `ClusterPoolOptions extends PoolOptions`

- `env` (optional) - An object with the environment variables to pass to worker. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_fork_env) for more details.

- `settings` (optional) - An object with the cluster settings. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_settings) for more details.

### `pool = new FixedThreadPool/FixedClusterPool(numberOfThreads/numberOfWorkers, filePath, opts)`

`numberOfThreads/numberOfWorkers` (mandatory) Number of workers for this pool  
`filePath` (mandatory) Path to a file with a worker implementation  
`opts` (optional) An object with the pool options properties described above

### `pool = new DynamicThreadPool/DynamicClusterPool(min, max, filePath, opts)`

`min` (mandatory) Same as FixedThreadPool/FixedClusterPool numberOfThreads/numberOfWorkers, this number of workers will be always active  
`max` (mandatory) Max number of workers that this pool can contain, the new created workers will die after a threshold (default is 1 minute, you can override it in your worker implementation).  
`filePath` (mandatory) Path to a file with a worker implementation  
`opts` (optional) An object with the pool options properties described above

### `pool.execute(data, name)`

`data` (optional) An object that you want to pass to your worker implementation  
`name` (optional) A string with the task function name that you want to execute on the worker. Default: `'default'`

This method is available on both pool implementations and returns a promise with the task function execution response.

### `pool.destroy()`

This method is available on both pool implementations and will call the terminate method on each worker.

### `class YourWorker extends ThreadWorker/ClusterWorker`

`taskFunctions` (mandatory) The task function or task functions object `{ name_1: fn_1, ..., name_n: fn_n }` that you want to execute on the worker  
`opts` (optional) An object with these properties:

- `maxInactiveTime` (optional) - Maximum waiting time in milliseconds for tasks on newly created workers. After this time newly created workers will die.  
  The last active time of your worker will be updated when it terminates a task.  
  If `killBehavior` is set to `KillBehaviors.HARD` this value represents also the timeout for the tasks that you submit to the pool, when this timeout expires your tasks is interrupted before completion and removed. The worker is killed if is not part of the minimum size of the pool.  
  If `killBehavior` is set to `KillBehaviors.SOFT` your tasks have no timeout and your workers will not be terminated until your task is completed.  
  Default: `60000`

- `killBehavior` (optional) - Dictates if your worker will be deleted in case a task is active on it.  
  **KillBehaviors.SOFT**: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still executing or queued, then the worker **won't** be deleted.  
  **KillBehaviors.HARD**: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but a task is still executing or queued, then the worker will be deleted.  
  This option only apply to the newly created workers.  
  Default: `KillBehaviors.SOFT`

#### `YourWorker.hasTaskFunction(name)`

`name` (mandatory) The task function name

This method is available on both worker implementations and returns a boolean.

#### `YourWorker.addTaskFunction(name, fn)`

`name` (mandatory) The task function name  
`fn` (mandatory) The task function

This method is available on both worker implementations and returns a boolean.

#### `YourWorker.removeTaskFunction(name)`

`name` (mandatory) The task function name

This method is available on both worker implementations and returns a boolean.

#### `YourWorker.listTaskFunctions()`

This method is available on both worker implementations and returns an array of the task function names.

#### `YourWorker.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name

This method is available on both worker implementations and returns a boolean.

## General guidance

Performance is one of the main target of these worker pool implementations, we want to have a strong focus on this.  
We already have a [benchmarks](./benchmarks/) folder where you can find some comparisons.

### Internal Node.js thread pool

Before to jump into each poolifier pool type, let highlight that **Node.js comes with a thread pool already**, the libuv thread pool where some particular tasks already run by default.  
Please take a look at [which tasks run on the libuv thread pool](https://nodejs.org/en/docs/guides/dont-block-the-event-loop/#what-code-runs-on-the-worker-pool).

**If your task runs on libuv thread pool**, you can try to:

- Tune the libuv thread pool size setting the [UV_THREADPOOL_SIZE](https://nodejs.org/api/cli.html#cli_uv_threadpool_size_size).

and/or

- Use poolifier cluster pool that is spawning child processes, they will also increase the number of libuv threads since that any new child process comes with a separated libuv thread pool. **More threads does not mean more fast, so please tune your application**.

### Cluster vs Threads worker pools

**If your task does not run into libuv thread pool** and is CPU intensive then poolifier **thread pools** (FixedThreadPool and DynamicThreadPool) are suggested to run CPU intensive tasks, you can still run I/O intensive tasks into thread pools, but performance enhancement is expected to be minimal.  
Thread pools are built on top of Node.js [worker_threads](https://nodejs.org/api/worker_threads.html) module.

**If your task does not run into libuv thread pool** and is I/O intensive then poolifier **cluster pools** (FixedClusterPool and DynamicClusterPool) are suggested to run I/O intensive tasks, again you can still run CPU intensive tasks into cluster pools, but performance enhancement is expected to be minimal.  
Consider that by default Node.js already has great performance for I/O tasks (asynchronous I/O).  
Cluster pools are built on top of Node.js [cluster](https://nodejs.org/api/cluster.html) module.

If your task contains code that runs on libuv plus code that is CPU intensive or I/O intensive you either split it either combine more strategies (i.e. tune the number of libuv threads and use cluster/thread pools).  
But in general, **always profile your application**.

### Fixed vs Dynamic pools

To choose your pool consider that with a FixedThreadPool/FixedClusterPool or a DynamicThreadPool/DynamicClusterPool (in this case is important the min parameter passed to the constructor) your application memory footprint will increase.  
Increasing the memory footprint, your application will be ready to accept more tasks, but during idle time your application will consume more memory.  
One good choice from poolifier team point of view is to profile your application using fixed or dynamic worker pool, and to see your application metrics when you increase/decrease the num of workers.  
For example you could keep the memory footprint low choosing a DynamicThreadPool/DynamicClusterPool with 5 workers, and allow to create new workers until 50/100 when needed, this is the advantage to use the DynamicThreadPool/DynamicClusterPool.  
But in general, **always profile your application**.

## Contribute

Choose your task here [2.6.x](https://github.com/orgs/poolifier/projects/1), propose an idea, a fix, an improvement.

See [CONTRIBUTING](CONTRIBUTING.md) guidelines.

## Team

**Creator/Owner:**

- [**Alessandro Pio Ardizio**](https://github.com/pioardi)

**_Contributors_**

- [**Shinigami92**](https://github.com/Shinigami92)
- [**Jérôme Benoit**](https://github.com/jerome-benoit)

## License

[MIT](./LICENSE)
