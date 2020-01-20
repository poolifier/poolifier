const start = Date.now()
const toBench = () => {
  const iterations = 10000

  for (let i = 0; i <= iterations; i++) {
    const o = {
      a: i
    }
    JSON.stringify(o)
  }
}

for (let i = 0; i < 1000; i++) {
  toBench()
}
console.log('Time take is ' + (Date.now() - start))
