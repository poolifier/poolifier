# Node Thread Pool :arrow_double_up: :on:
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Dependabot](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)
[![Actions Status](https://github.com/pioardi/node-pool/workflows/NodeCI/badge.svg)](https://github.com/pioardi/node-pool/actions)

<h2>Contents </h2>
<h3 align="center">
  <a href="#installation">Installation</a>
  <span> · </span>
  <a href="#usage">Usage</a>
  <span> · </span>
  <a href="#api">API</a>
  <span> · </span>
  <a href="#contribute">Contribute</a>
  <span> · </span>
  <a href="#nv">Compatibility</a>
  <span> · </span>
  <a href="#license">License</a>
</h3>

<h2> Overview </h2>
Node pool contains two <a href="https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads">worker-threads </a> pool implementations , you don' t have to deal with worker-threads complexity. <br>
The first implementation is a static thread pool , with a defined number of threads that are started at creation time .<br>
The second implementation is a dynamic thread pool with a number of threads started at creation time and other threads created when the load will increase ( with an upper limit ), the new created threads will be stopped after a threshold. <br>
You have to implement your worker extending the ThreadWorker class<br>
<h2 id="installation">Installation</h2>

```
npm install node-pool --save
```
<h2 id="usage">Usage</h2>

You can implement a worker in a simple way , extending the class ThreadWorker : 

```js
'use strict'
const { ThreadWorker } = require('node-pool')

class MyWorker extends ThreadWorker {
  constructor () {
    super((data) => {
      // this will be executed in the worker thread,
      // the data will be received by using the execute method
      return { ok: 1 }
    }, { maxInactiveTime: 1000 * 60})
  }
}
module.exports = new MyWorker()
```

Instantiate your pool based on your needed : 

```js
'use strict'
const { FixedThreadPool, DynamicThreadPool } = require('node-pool')

// a fixed thread pool
const pool = new FixedThreadPool(15,
  './yourWorker.js')

// or a dynamic thread pool
const pool = new DynamicThreadPool(10, 100,
  './yourWorker.js')
pool.emitter.on('FullPool', () => console.log('Pool is full'))

// the execute method signature is the same for both implementations,
// so you can easy switch from one to another
pool.execute({}).then(res => {
  console.log(res)
}).catch .... 

```

<strong> See examples folder for more details.</strong>

<h2 id="nv">Node versions</h2>

You can use node version  10.x  with --experimental-worker flag, or you can use an higher version (i.e 12.x) <br>

<h2 id="api">API</h2>

### `pool = new FixedThreadPool(numThreads, filePath, opts)`
`numThreads` (mandatory) Num of threads for this worker pool <br>
`filePath` (mandatory) Path to a file with a worker implementation <br>
`opts` (optional) An object with these properties :
- `errorHandler` - A function that will listen for error event on each worker thread
- `onlineHandler` - A function that will listen for online event on each worker thread
- `exitHandler` - A function that will listen for exit event on each worker thread
- `maxTasks` - This is just to avoid not useful warnings message, is used to set <a href="https://nodejs.org/dist/latest-v12.x/docs/api/events.html#events_emitter_setmaxlisteners_n">maxListeners</a> on event emitters ( workers are event emitters)

### `pool = new DynamicThreadPool(min, max, filePath, opts)`
`min` (mandatory) Same as FixedThreadPool numThreads , this number of threads will be always active <br>
`max` (mandatory) Max number of workers that this pool can contain, the new created threads will die after a threshold ( default is 1 minute , you can override it in your worker implementation). <br>
`filePath` (mandatory) Same as FixedThreadPool  <br>
`opts` (optional) Same as FixedThreadPool <br>

### `pool.execute(data)`
Execute method is available on both pool implementations ( return type : Promise): <br>
`data` (mandatory) An object that you want to pass to your worker implementation <br>

### `pool.destroy()`
Destroy method is available on both pool implementations.<br>
This method will call the terminate method on each worker.


### `class YourWorker extends ThreadWorker`
`fn` (mandatory) The function that you want to execute on the worker thread <br>
`opts` (optional) An object with these properties :
- `maxInactiveTime` - Max time to wait tasks to work on ( in ms) , after this period the new worker threads will die.

<h2 id="contribute">Contribute</h2>

See guidelines [CONTRIBUTING](./.github/CONTRIBUTING.md)


<h2 id="license">License</h2>

[MIT](https://github.com/pioardi/node-pool/blob/master/LICENSE)

