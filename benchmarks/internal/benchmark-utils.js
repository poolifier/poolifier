async function runPoolifierTest (pool, { tasks, workerData }) {
  return new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 1; i <= tasks; i++) {
      pool
        .execute(workerData)
        .then(res => {
          executions++
          if (executions === tasks) {
            return resolve('FINISH')
          }
          return null
        })
        .catch(err => {
          console.error(err)
          return reject(err)
        })
    }
  })
}

function jsonIntegerSerialization (n) {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
}

function generateRandomInteger (max, min = 0) {
  max = Math.floor(max)
  if (min) {
    min = Math.ceil(min)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  return Math.floor(Math.random() * (max + 1))
}

/**
 * Intentionally inefficient implementation.
 *
 * @param {number} n
 * @returns {number}
 */
function fibonacci (n) {
  if (n <= 1) return 1
  return fibonacci(n - 1) + fibonacci(n - 2)
}

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

module.exports = {
  runPoolifierTest,
  jsonIntegerSerialization,
  generateRandomInteger,
  fibonacci,
  LIST_FORMATTER
}
