const { randomInt } = require('node:crypto')
const {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs')

const { TaskFunctions } = require('./benchmarks-types.cjs')

const jsonIntegerSerialization = n => {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i,
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

/**
 * @param n - The number of fibonacci numbers to generate.
 * @returns - The nth fibonacci number.
 */
const fibonacci = n => {
  n = BigInt(n)
  let current = 1n
  let previous = 0n
  while (--n) {
    const tmp = current
    current += previous
    previous = tmp
  }
  // cluster worker do not support BigInt
  return current.toString()
}

/**
 * @param n - The number to calculate the factorial of.
 * @returns - The factorial of n.
 */
const factorial = n => {
  if (n === 0 || n === 1) {
    return 1n
  }
  n = BigInt(n)
  let factorial = 1n
  for (let i = 1n; i <= n; i++) {
    factorial *= i
  }
  // cluster worker do not support BigInt
  return factorial.toString()
}

const readWriteFiles = (
  n,
  baseDirectory = `/tmp/poolifier-benchmarks/${randomInt(281474976710655)}`
) => {
  if (existsSync(baseDirectory) === true) {
    rmSync(baseDirectory, { recursive: true })
  }
  mkdirSync(baseDirectory, { recursive: true })
  for (let i = 0; i < n; i++) {
    const filePath = `${baseDirectory}/${i}`
    writeFileSync(filePath, i.toString(), {
      encoding: 'utf8',
      flag: 'a',
    })
    readFileSync(filePath, 'utf8')
  }
  rmSync(baseDirectory, { recursive: true })
  return { ok: 1 }
}

const executeTaskFunction = data => {
  switch (data.function) {
    case TaskFunctions.factorial:
      return factorial(data.taskSize || 1000)
    case TaskFunctions.fibonacci:
      return fibonacci(data.taskSize || 1000)
    case TaskFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.taskSize || 1000)
    case TaskFunctions.readWriteFiles:
      return readWriteFiles(data.taskSize || 1000)
    default:
      throw new Error('Unknown task function')
  }
}

module.exports = {
  executeTaskFunction,
}
