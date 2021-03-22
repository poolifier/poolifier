module.exports = function (data) {
  if (data.taskType === 'CPU_INTENSIVE') {
    // CPU intensive task
    for (let i = 0; i < 5000; i++) {
      const o = {
        a: i
      }
      JSON.stringify(o)
    }
    return { ok: 1 }
  } else {
    throw new Error('Please specify the task type')
  }
}
