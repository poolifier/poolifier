import Benchmark from 'benny'

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

Benchmark.suite(
  'Round robin tasks distribution',
  Benchmark.add('Ternary off by one', () => {
    nextWorkerIndex = 0
    roundRobinTernaryOffByOne()
  }),
  Benchmark.add('Ternary with negation', () => {
    nextWorkerIndex = 0
    roundRobinTernaryWithNegation()
  }),
  Benchmark.add('Ternary with pre-choosing', () => {
    nextWorkerIndex = 0
    roundRobinTernaryWithPreChoosing()
  }),
  Benchmark.add('Increment+Modulo', () => {
    nextWorkerIndex = 0
    roundRobinIncrementModulo()
  }),
  Benchmark.cycle(),
  Benchmark.complete()
)
