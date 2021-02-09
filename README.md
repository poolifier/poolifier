# Node Thread Pool :arrow_double_up: :on:

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Dependabot](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)
[![npm w](https://img.shields.io/npm/dw/poolifier)](https://www.npmjs.com/package/poolifier)
[![Actions Status](https://github.com/pioardi/node-pool/workflows/NodeCI/badge.svg)](https://github.com/pioardi/node-pool/actions)
[![Coverage Status](https://coveralls.io/repos/github/pioardi/poolifier/badge.svg?branch=master)](https://coveralls.io/github/pioardi/poolifier?branch=master)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![NODEP](https://img.shields.io/static/v1?label=dependencies&message=no%20dependencies&color=brightgreen)](https://img.shields.io/static/v1?label=dependencies&message=no%20dependencies&color=brightgreen)
[![Gitter](https://badges.gitter.im/poolifier/community.svg)](https://gitter.im/poolifier/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

## Why Poolifier?

Poolifier is used to perform heavy CPU bound tasks on nodejs servers, it implements thread pools (yes, more thread pool implementations, so you can choose which one fit better for you) using [worker-threads](https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads).  
With poolifier you can improve your **performance** and resolve problems related to the event loop.  
Moreover you can execute your CPU tasks using an API designed to improve the **developer experience**.

## Contents

<h3 align="center">
  <a href="#overview">Overview</a>
  <span> · </span>
  <a href="#installation">Installation</a>
  <span> · </span>
  <a href="#usage">Usage</a>
  <span> · </span>
  <a href="#node-versions">  Node versions</a>
  <span> · </span>
  <a href="#api">API</a>
  <span> · </span>
  <a href="#choose-your-pool">Choose your pool</a>
  <span> · </span>
  <a href="#contribute">Contribute</a>
  <span> · </span>
  <a href="#team">Team</a>
  <span> · </span>
  <a href="#license">License</a>
</h3>

## Overview

Node pool contains two [worker-threads](https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads) pool implementations, you don't have to deal with worker-threads complexity.  
The first implementation is a static thread pool, with a defined number of threads that are started at creation time and will be reused.  
The second implementation is a dynamic thread pool with a number of threads started at creation time (these threads will be always active and reused) and other threads created when the load will increase (with an upper limit, these threads will be reused when active), the new created threads will be stopped after a configurable period of inactivity.  
You have to implement your worker extending the ThreadWorker class

## Installation

```shell
npm install poolifier --save
```

## Usage

You can implement a worker in a simple way, extending the class ThreadWorker:

```js
'use strict'
const { ThreadWorker } = require('poolifier')

function yourFunction (data) {
  // this will be executed in the worker thread,
  // the data will be received by using the execute method
  return { ok: 1 }
}

module.exports = new ThreadWorker(yourFunction, {
  maxInactiveTime: 60000,
  async: false
})
```

Instantiate your pool based on your needed :

```js
'use strict'
const { FixedThreadPool, DynamicThreadPool } = require('poolifier')

// a fixed thread pool
const pool = new FixedThreadPool(15,
  './yourWorker.js',
  { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })

// or a dynamic thread pool
const pool = new DynamicThreadPool(10, 100,
  './yourWorker.js',
  { errorHandler: (e) => console.error(e), onlineHandler: () => console.log('worker is online') })

pool.emitter.on('FullPool', () => console.log('Pool is full'))

// the execute method signature is the same for both implementations,
// so you can easy switch from one to another
pool.execute({}).then(res => {
  console.log(res)
}).catch ....

```

**See examples folder for more details (in particular if you want to use a pool for [multiple functions](./examples/multiFunctionExample.js)).**
**Now type script is also supported, find how to use it into the example folder**

## Node versions

You can use node versions 12.x, 13.x, 14.x

## API

### `pool = new FixedThreadPool(numThreads, filePath, opts)`

`numThreads` (mandatory) Num of threads for this worker pool  
`filePath` (mandatory) Path to a file with a worker implementation  
`opts` (optional) An object with these properties :

- `errorHandler` - A function that will listen for error event on each worker thread
- `onlineHandler` - A function that will listen for online event on each worker thread
- `exitHandler` - A function that will listen for exit event on each worker thread
- `maxTasks` - This is just to avoid not useful warnings message, is used to set [maxListeners](https://nodejs.org/dist/latest-v12.x/docs/api/events.html#events_emitter_setmaxlisteners_n) on event emitters (workers are event emitters)

### `pool = new DynamicThreadPool(min, max, filePath, opts)`

`min` (mandatory) Same as FixedThreadPool numThreads, this number of threads will be always active  
`max` (mandatory) Max number of workers that this pool can contain, the new created threads will die after a threshold (default is 1 minute, you can override it in your worker implementation).  
`filePath` (mandatory) Same as FixedThreadPool  
`opts` (optional) Same as FixedThreadPool

### `pool.execute(data)`

Execute method is available on both pool implementations (return type : Promise):  
`data` (mandatory) An object that you want to pass to your worker implementation

### `pool.destroy()`

Destroy method is available on both pool implementations.  
This method will call the terminate method on each worker.

### `class YourWorker extends ThreadWorker`

`fn` (mandatory) The function that you want to execute on the worker thread  
`opts` (optional) An object with these properties:

- `maxInactiveTime` - Max time to wait tasks to work on ( in ms) , after this period the new worker threads will die.
- `async` - true/false, true if your function contains async pieces else false

## Choose your pool

Performance is one of the main target of these thread pool implementations, we want to have a strong focus on this.  
We already have a bench folder where you can find some comparisons.
To choose your pool consider that with a FixedThreadPool or a DynamicThreadPool (in this case is important the min parameter passed to the constructor) your application memory footprint will increase.  
Increasing the memory footprint, your application will be ready to accept more CPU bound tasks, but during idle time your application will consume more memory.  
One good choose from my point of view is to profile your application using Fixed/Dynamic thread pool, and to see your application metrics when you increase/decrease the num of threads.  
For example you could keep the memory footprint low choosing a DynamicThreadPool with 5 threads, and allow to create new threads until 50/100 when needed, this is the advantage to use the DynamicThreadPool.  
But in general, **always profile your application**

## Contribute

See guidelines [CONTRIBUTING](CONTRIBUTING.md)  
Choose your task here [2.0.0](https://github.com/pioardi/poolifier/projects/1), propose an idea, a fix, an improvement.

## Team

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

**Creator/Owner:**

- [**Alessandro Pio Ardizio**](https://github.com/pioardi)

**_Contributors_**

- [**Shinigami92**](https://github.com/Shinigami92)
- [**Jérôme Benoit**](https://github.com/jerome-benoit)

## License

[MIT](./LICENSE)
