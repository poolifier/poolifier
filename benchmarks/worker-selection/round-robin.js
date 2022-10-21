const Benchmark = require('benchmark')
const { LIST_FORMATTER } = require('../benchmarks-utils')

const suite = new Benchmark.Suite()

function generateWorkersArray (numberOfWorkers) {
  return [...Array(numberOfWorkers).keys()]
}

const workers = generateWorkersArray(60)

let nextWorkerIndex

function roundRobinTernaryOffByOne () {
  nextWorkerIndex =
    workers.length - 1 === nextWorkerIndex ? 0 : nextWorkerIndex + 1
  return workers[nextWorkerIndex]
}

function roundRobinTernaryWithNegation () {
  nextWorkerIndex =
    !nextWorkerIndex || workers.length - 1 === nextWorkerIndex
      ? 0
      : nextWorkerIndex + 1
  return workers[nextWorkerIndex]
}

function roundRobinTernaryWithPreChoosing () {
  const chosenWorker = workers[nextWorkerIndex]
  nextWorkerIndex =
    workers.length - 1 === nextWorkerIndex ? 0 : nextWorkerIndex + 1
  return chosenWorker
}

function roundRobinIncrementModulo () {
  const chosenWorker = workers[nextWorkerIndex]
  nextWorkerIndex++
  nextWorkerIndex %= workers.length
  return chosenWorker
}

suite
  .add('Ternary off by one', function () {
    nextWorkerIndex = 0
    roundRobinTernaryOffByOne()
  })
  .add('Ternary with negation', function () {
    nextWorkerIndex = 0
    roundRobinTernaryWithNegation()
  })
  .add('Ternary with pre-choosing', function () {
    nextWorkerIndex = 0
    roundRobinTernaryWithPreChoosing()
  })
  .add('Increment+Modulo', function () {
    nextWorkerIndex = 0
    roundRobinIncrementModulo()
  })
  .on('cycle', function (event) {
    console.log(event.target.toString())
  })
  .on('complete', function () {
    console.log(
      'Fastest is ' + LIST_FORMATTER.format(this.filter('fastest').map('name'))
    )
    // eslint-disable-next-line n/no-process-exit
    process.exit()
  })
  .run()
