import { Bench } from 'tinybench'

/**
 * Generates an array of worker indices.
 * @param numberOfWorkers - The number of workers.
 * @returns The array of worker indices.
 */
function generateWorkersArray (numberOfWorkers) {
  return [...Array(numberOfWorkers).keys()]
}

const workers = generateWorkersArray(60)

let nextWorkerIndex

/**
 * Round-robin worker selection using increment and modulo operation.
 * @returns The selected worker.
 */
function roundRobinIncrementModulo () {
  const chosenWorker = workers[nextWorkerIndex]
  nextWorkerIndex++
  nextWorkerIndex %= workers.length
  return chosenWorker
}

/**
 * Round-robin worker selection using ternary operator with off-by-one logic.
 * @returns The selected worker.
 */
function roundRobinTernaryOffByOne () {
  nextWorkerIndex =
    workers.length - 1 === nextWorkerIndex ? 0 : nextWorkerIndex + 1
  return workers[nextWorkerIndex]
}

/**
 * Round-robin worker selection using ternary operator with negation.
 * @returns The selected worker.
 */
function roundRobinTernaryWithNegation () {
  nextWorkerIndex =
    !nextWorkerIndex || workers.length - 1 === nextWorkerIndex
      ? 0
      : nextWorkerIndex + 1
  return workers[nextWorkerIndex]
}

/**
 * Round-robin worker selection using ternary operator with pre-choosing.
 * @returns The selected worker.
 */
function roundRobinTernaryWithPreChoosing () {
  const chosenWorker = workers[nextWorkerIndex]
  nextWorkerIndex =
    workers.length - 1 === nextWorkerIndex ? 0 : nextWorkerIndex + 1
  return chosenWorker
}

const bench = new Bench()

bench.add('Ternary off by one', () => {
  nextWorkerIndex = 0
  roundRobinTernaryOffByOne()
})
bench.add('Ternary with negation', () => {
  nextWorkerIndex = 0
  roundRobinTernaryWithNegation()
})
bench.add('Ternary with pre-choosing', () => {
  nextWorkerIndex = 0
  roundRobinTernaryWithPreChoosing()
})
bench.add('Increment+Modulo', () => {
  nextWorkerIndex = 0
  roundRobinIncrementModulo()
})

await bench.run()
console.table(bench.table())
