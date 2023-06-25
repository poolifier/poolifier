import crypto from 'crypto'
import fs from 'fs'

/**
 * The worker function to execute during pools benchmarks.
 * NOTE: This function requires to be self-contained, thread-safe and re-entrant.
 * @param {*} data The worker data.
 * @returns {*} The result.
 */
export default async function functionToBench (data) {
  const TaskTypes = {
    CPU_INTENSIVE: 'CPU_INTENSIVE',
    IO_INTENSIVE: 'IO_INTENSIVE'
  }
  data = data || {}
  data.taskType = data.taskType || TaskTypes.CPU_INTENSIVE
  data.taskSize = data.taskSize || 5000
  const baseDirectory = `/tmp/poolifier-benchmarks/${crypto.randomInt(
    281474976710655
  )}`
  switch (data.taskType) {
    case TaskTypes.CPU_INTENSIVE:
      // CPU intensive task
      for (let i = 0; i < data.taskSize; i++) {
        const o = {
          a: i
        }
        JSON.stringify(o)
      }
      return { ok: 1 }
    case TaskTypes.IO_INTENSIVE:
      // IO intensive task
      if (fs.existsSync(baseDirectory) === true) {
        fs.rmSync(baseDirectory, { recursive: true })
      }
      fs.mkdirSync(baseDirectory, { recursive: true })
      for (let i = 0; i < data.taskSize; i++) {
        const filePath = `${baseDirectory}/${i}`
        fs.writeFileSync(filePath, i.toString(), {
          encoding: 'utf8',
          flag: 'a'
        })
        fs.readFileSync(filePath, 'utf8')
      }
      fs.rmSync(baseDirectory, { recursive: true })
      return { ok: 1 }
    default:
      throw new Error(`Unknown task type: ${data.taskType}`)
  }
}
