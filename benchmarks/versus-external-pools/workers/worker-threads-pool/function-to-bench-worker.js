'use strict'
const { workerData } = require('worker_threads')
const functionToBench = require('../../functions/function-to-bench')
functionToBench(workerData)
