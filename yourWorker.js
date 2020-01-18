'use strict'
const { ThreadWorker, DynamicWorker } = require('./lib/workers')

class MyWorker extends DynamicWorker {
  constructor () {
    super((data) => {
      for (let i = 0; i <= 10000; i++) {
        const o = {
          a: i
        }
        JSON.stringify(o)
      }
      // console.log('This is the main thread ' + isMainThread)
      return data
    })
  }
}

module.exports = new MyWorker()
