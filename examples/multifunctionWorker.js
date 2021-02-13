'use strict'
const { ThreadWorker } = require('poolifier')

function yourFunction (data) {
  if (data.functionName === 'fn0') {
    console.log('Executing function 0')
    return { data: '0 your input was' + data.input }
  } else if (data.functionName === 'fn1') {
    console.log('Executing function 1')
    return { data: '1 your input was' + data.input }
  }
}

module.exports = new ThreadWorker(yourFunction)
