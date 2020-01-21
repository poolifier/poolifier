const uuidv1 = require('uuid/v1')
const uuidv4 = require('uuid/v4')
const uuidv5 = require('uuid/v5')
const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const MY_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'

// add tests
suite.add('uuid v4', function () {
  uuidv4()
})
  .add('uuid v5', function () {
    uuidv5('Hello, World!', MY_NAMESPACE)
  })
  .add('uuid v1', async function () {
    uuidv1()
  })
// add listeners
  .on('cycle', function (event) {
    console.log(String(event.target))
  })
  .on('complete', function () {
    this.filter('fastest').map('name')
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
// run async
  .run({ async: true })
