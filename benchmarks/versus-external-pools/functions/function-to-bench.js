module.exports = function (data) {
  data = data || {}
  data.taskType = data.taskType || 'CPU_INTENSIVE'
  data.taskSize = data.taskSize || 5000
  switch (data.taskType) {
    case 'CPU_INTENSIVE':
      // CPU intensive task
      for (let i = 0; i < data.taskSize; i++) {
        const o = {
          a: i
        }
        JSON.stringify(o)
      }
      return { ok: 1 }
    default:
      throw new Error(`Unknown task type: ${data.taskType}`)
  }
}
