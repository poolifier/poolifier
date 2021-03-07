const Benchmark = require('benchmark')
const { LIST_FORMATTER } = require('./benchmark-utils')

const suite = new Benchmark.Suite()

function generateWorkersArray (numberOfWorkers) {
  return [...Array(numberOfWorkers).keys()]
}

const workers = generateWorkersArray(60)

let nextWorkerIndex

function chooseWorkerTernaryOffByOne () {
  nextWorkerIndex =
    workers.length - 1 === nextWorkerIndex ? 0 : nextWorkerIndex + 1
  return workers[nextWorkerIndex]
}

function chooseWorkerTernaryWithNegation () {
  nextWorkerIndex =
    !nextWorkerIndex || workers.length - 1 === nextWorkerIndex
      ? 0
      : nextWorkerIndex + 1
  return workers[nextWorkerIndex]
}

function chooseWorkerTernaryWithPreChoosing () {
  const chosenWorker = workers[nextWorkerIndex]
  nextWorkerIndex =
    workers.length - 1 === nextWorkerIndex ? 0 : nextWorkerIndex + 1
  return chosenWorker
}

function chooseWorkerIncrementModulo () {
  const chosenWorker = workers[nextWorkerIndex]
  nextWorkerIndex++
  nextWorkerIndex %= workers.length
  return chosenWorker
}

suite
  .add('Ternary off by one', function () {
    nextWorkerIndex = 0
    chooseWorkerTernaryOffByOne()
  })
  .add('Ternary with negation', function () {
    nextWorkerIndex = 0
    chooseWorkerTernaryWithNegation()
  })
  .add('Ternary with pre-choosing', function () {
    nextWorkerIndex = 0
    chooseWorkerTernaryWithPreChoosing()
  })
  .add('Increment+Modulo', function () {
    nextWorkerIndex = 0
    chooseWorkerIncrementModulo()
  })
  .on('cycle', function (event) {
    console.log(event.target.toString())
  })
  .on('complete', function () {
    console.log(
      'Fastest is ' + LIST_FORMATTER.format(this.filter('fastest').map('name'))
    )
    // eslint-disable-next-line no-process-exit
    process.exit()
  })
  .run()
