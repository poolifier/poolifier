/**
 * The worker function to execute during pools benchmarks.
 * NOTE: This function requires to be self-contained, thread-safe and re-entrant.
 *
 * @param {*} data The worker data.
 * @returns {*} The result.
 */
function functionToBench (data) {
  const fs = require('fs')
  const TaskTypes = {
    CPU_INTENSIVE: 'CPU_INTENSIVE',
    IO_INTENSIVE: 'IO_INTENSIVE'
  }
  data = data || {}
  data.taskType = data.taskType || TaskTypes.CPU_INTENSIVE
  data.taskSize = data.taskSize || 5000
  const baseDirectory = '/tmp/poolifier-benchmarks'
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
      if (fs.existsSync(baseDirectory) === false) {
        fs.mkdirSync(baseDirectory, { recursive: true })
      }
      for (let i = 0; i < data.taskSize; i++) {
        const filePath = `${baseDirectory}/${i}`
        fs.writeFileSync(filePath, i.toString(), {
          encoding: 'utf8',
          flag: 'a'
        })
        fs.readFileSync(filePath, 'utf8')
      }
      return { ok: 1 }
    default:
      throw new Error(`Unknown task type: ${data.taskType}`)
  }
}

module.exports = functionToBench
