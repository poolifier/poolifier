'use strict'
const { ThreadWorker, KillBehaviors } = require('../../../lib/index')

async function error (data) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error(data)), 2000)
  })
}

module.exports = new ThreadWorker(error, {
  maxInactiveTime: 500,
  async: true,
  killBehavior: KillBehaviors.HARD
})
