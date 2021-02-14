const Benchmark = require('benchmark')

const suite = new Benchmark.Suite()

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

const workers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

let nextWorkerIndex = 0

function chooseWorkerTernary () {
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
  .add('Ternary', function () {
    nextWorkerIndex = 0
    chooseWorkerTernary()
  })
  .add('Ternary with negation', function () {
    nextWorkerIndex = 0
    chooseWorkerTernaryWithNegation()
  })
  .add('Ternary with PreChoosing', function () {
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
