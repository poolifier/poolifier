'use strict'
const { ThreadWorker } = require('poolifier')

function fn0 (data) {
  console.info('Executing function 0')
  return { data: `fn0 your input text was '${data.text}'` }
}

function fn1 (data) {
  console.info('Executing function 1')
  return { data: `fn1 your input text was '${data.text}'` }
}

module.exports = new ThreadWorker({ fn0, fn1 })
