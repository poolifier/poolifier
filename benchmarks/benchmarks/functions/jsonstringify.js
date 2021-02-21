module.exports = function (data) {
  for (let i = 0; i <= 5000; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
  // console.log('STRINGIFY FUNCTION FINISHED')
  return { ok: 1 }
}
