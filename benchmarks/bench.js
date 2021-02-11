const Benchmark = require('benchmark')
const { dynamicClusterTest } = require('./cluster/dynamic')
const { fixedClusterTest } = require('./cluster/fixed')
const { dynamicThreadTest } = require('./thread/dynamic')
const { fixedThreadTest } = require('./thread/fixed')

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
    .add('Pioardi:Static:ThreadPool', async function () {
      await fixedThreadTest()
    })
    .add('Pioardi:Dynamic:ThreadPool', async function () {
      await dynamicThreadTest()
    })
    .add('Pioardi:Static:ClusterPool', async function () {
      await fixedClusterTest()
    })
    .add('Pioardi:Dynamic:ClusterPool', async function () {
      await dynamicClusterTest()
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
