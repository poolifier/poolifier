'use strict'
const { ThreadWorker } = require('poolifier')
const jsonStringify = require('../../functions/jsonstringify')
module.exports = new ThreadWorker(jsonStringify)
