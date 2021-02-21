'use strict'
/* eslint-disable node/no-missing-require */
const { ThreadWorker } = require('poolifier')
const jsonStringify = require('../../functions/json-stringify')
module.exports = new ThreadWorker(jsonStringify)
