# Node Pool :arrow_double_up: :on:
[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)
[![Dependabot](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)
[![Actions Status](https://github.com/pioardi/node-pool/workflows/NodeCI/badge.svg)](https://github.com/pioardi/node-pool/actions)

Node pool contains two <a href="https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads">worker-threads </a> pool implementations , you don' t have to deal with worker-threads complexity. <br>
The first implementation is a static thread pool , with a defined number of threads that are started at creation time .<br>
The second implementation is a dynamic thread pool with a number of threads started at creation time and other threads created when the load will increase ( with an upper limit ). <br>

## Installation
```
npm install node-pool --save
```
# Usage

You can implement a worker in a simple way , extending the class ThreadWorker : 

```js
'use strict'
const { ThreadWorker } = require('node-pool')

class MyWorker extends ThreadWorker {
  constructor () {
    super((data) => {
      // this will be executed in the worker thread, the data will be received by using the execute method
      return { ok: 1 }
    })
  }
}
module.exports = new MyWorker()
```

Instantiate your pool based on your needed : 

```js
'use strict'
const { FixedThreadPool  } = require('node-pool')

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

## Node versions
You can use node version  10.x  with --experimental-worker flag, or you can use 12.x version <br>

## API

TODO

## License

[MIT](https://github.com/pioardi/node-pool/blob/master/LICENSE)

