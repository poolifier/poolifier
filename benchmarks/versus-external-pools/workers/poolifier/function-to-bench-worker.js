'use strict'
const { ThreadWorker } = require('poolifier')
const functionToBench = require('../../functions/function-to-bench')
module.exports = new ThreadWorker(functionToBench)
