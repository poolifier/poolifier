import Benchmark from 'benchmark'
import { LIST_FORMATTER } from '../benchmarks-utils.js'

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

new Benchmark.Suite('Round robin tasks distribution')
  .add('Ternary off by one', () => {
    nextWorkerIndex = 0
    roundRobinTernaryOffByOne()
  })
  .add('Ternary with negation', () => {
    nextWorkerIndex = 0
    roundRobinTernaryWithNegation()
  })
  .add('Ternary with pre-choosing', () => {
    nextWorkerIndex = 0
    roundRobinTernaryWithPreChoosing()
  })
  .add('Increment+Modulo', () => {
    nextWorkerIndex = 0
    roundRobinIncrementModulo()
  })
  .on('cycle', event => {
    console.info(event.target.toString())
  })
  .on('complete', function () {
    console.info(
      'Fastest is ' + LIST_FORMATTER.format(this.filter('fastest').map('name'))
    )
  })
  .run()
