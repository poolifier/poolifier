'use strict'
const { expose } = require('threads/worker')
const functionToBench = require('../../functions/function-to-bench')

expose({
  exposedFunction (data) {
    return functionToBench(data)
  }
})
