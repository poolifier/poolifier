const Benchmark = require('benchmark')
const { fixedThreadTest } = require('./thread/fixed')
const { dynamicThreadTest } = require('./thread/dynamic')

const suite = new Benchmark.Suite()

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

// wait some seconds before start, my pools need to load threads !!!
setTimeout(async () => {
  test()
}, 3000)

async function test () {
  // add tests
  suite
    .add('PioardiStaticPool', async function () {
      await fixedThreadTest()
    })
    .add('PioardiDynamicPool', async function () {
      await dynamicThreadTest()
    })
    // add listeners
    .on('cycle', function (event) {
      console.log(event.target.toString())
    })
    .on('complete', function () {
      console.log(
        'Fastest is ' +
          LIST_FORMATTER.format(this.filter('fastest').map('name'))
      )
      // eslint-disable-next-line no-process-exit
      process.exit()
    })
    // run async
    .run({ async: true })
}
