import { randomInt } from 'node:crypto'
import { bench, group, run } from 'tatami-ng'

/**
 * Generates a random tasks map for benchmarking.
 * @param numberOfWorkers - The number of workers.
 * @param maxNumberOfTasksPerWorker - The maximum number of tasks per worker.
 * @returns The generated tasks map.
 */
function generateRandomTasksMap (
  numberOfWorkers,
  maxNumberOfTasksPerWorker = 10
) {
  const tasksArray = []
  for (let i = 0; i < numberOfWorkers; i++) {
    const task = [i, randomInt(maxNumberOfTasksPerWorker)]
    tasksArray.push(task)
  }
  return new Map(tasksArray)
}

const tasksMap = generateRandomTasksMap(60, 20)

/**
 * Selects the worker with least tasks using array sort.
 * @param tasksMap - The tasks map.
 * @returns The worker with least tasks.
 */
function arraySortSelect (tasksMap) {
  const tasksArray = Array.from(tasksMap)
  return tasksArray.sort((a, b) => {
    if (a[1] < b[1]) {
      return -1
    }
    if (a[1] > b[1]) {
      return 1
    }
    return 0
  })[0]
}

/**
 * Selects the worker with least tasks using loop iteration.
 * @param tasksMap - The tasks map.
 * @returns The worker with least tasks.
 */
function loopSelect (tasksMap) {
  let minKey
  let minValue = Number.POSITIVE_INFINITY
  for (const [key, value] of tasksMap) {
    if (value === 0) {
      return key
    }
    if (value < minValue) {
      minKey = key
      minValue = value
    }
  }
  return [minKey, minValue]
}

const defaultComparator = (a, b) => {
  return a < b
}

const defaultPivotIndexSelect = (leftIndex, rightIndex) => {
  return leftIndex + Math.floor((rightIndex - leftIndex) / 2)
}

const randomPivotIndexSelect = (leftIndex, rightIndex) => {
  return randomInt(leftIndex, rightIndex)
}

/**
 * Partitions an array for quickselect algorithm.
 * @param array - The array to partition.
 * @param leftIndex - The left boundary index.
 * @param rightIndex - The right boundary index.
 * @param pivotIndex - The pivot element index.
 * @param compare - The comparison function.
 * @returns The new pivot index after partitioning.
 */
function partition (
  array,
  leftIndex,
  rightIndex,
  pivotIndex,
  compare = defaultComparator
) {
  const pivotValue = array[pivotIndex]
  swap(array, pivotIndex, rightIndex)
  let storeIndex = leftIndex
  for (let i = leftIndex; i < rightIndex; i++) {
    if (compare(array[i], pivotValue)) {
      swap(array, storeIndex, i)
      storeIndex++
    }
  }
  swap(array, rightIndex, storeIndex)
  return storeIndex
}

/**
 * Selects the worker with least tasks using quickselect loop algorithm.
 * @param tasksMap - The tasks map.
 * @returns The worker with least tasks.
 */
function quickSelectLoop (tasksMap) {
  const tasksArray = Array.from(tasksMap)

  return selectLoop(tasksArray, 0, 0, tasksArray.length - 1, (a, b) => {
    return a[1] < b[1]
  })
}

/**
 * Selects the worker with least tasks using quickselect loop with random pivot.
 * @param tasksMap - The tasks map.
 * @returns The worker with least tasks.
 */
function quickSelectLoopRandomPivot (tasksMap) {
  const tasksArray = Array.from(tasksMap)

  return selectLoop(
    tasksArray,
    0,
    0,
    tasksArray.length - 1,
    (a, b) => {
      return a[1] < b[1]
    },
    randomPivotIndexSelect
  )
}

/**
 * Selects the worker with least tasks using quickselect recursion algorithm.
 * @param tasksMap - The tasks map.
 * @returns The worker with least tasks.
 */
function quickSelectRecursion (tasksMap) {
  const tasksArray = Array.from(tasksMap)

  return selectRecursion(tasksArray, 0, 0, tasksArray.length - 1, (a, b) => {
    return a[1] < b[1]
  })
}

/**
 * Selects the worker with least tasks using quickselect recursion with random pivot.
 * @param tasksMap - The tasks map.
 * @returns The worker with least tasks.
 */
function quickSelectRecursionRandomPivot (tasksMap) {
  const tasksArray = Array.from(tasksMap)

  return selectRecursion(
    tasksArray,
    0,
    0,
    tasksArray.length - 1,
    (a, b) => {
      return a[1] < b[1]
    },
    randomPivotIndexSelect
  )
}

/**
 * Selects the k-th smallest element using quickselect loop algorithm.
 * @param array - The array to select from.
 * @param k - The index of the element to select.
 * @param leftIndex - The left boundary index.
 * @param rightIndex - The right boundary index.
 * @param compare - The comparison function.
 * @param pivotIndexSelect - The pivot selection function.
 * @returns The k-th smallest element.
 */
function selectLoop (
  array,
  k,
  leftIndex,
  rightIndex,
  compare = defaultComparator,
  pivotIndexSelect = defaultPivotIndexSelect
) {
  while (true) {
    if (leftIndex === rightIndex) return array[leftIndex]
    let pivotIndex = pivotIndexSelect(leftIndex, rightIndex)
    pivotIndex = partition(array, leftIndex, rightIndex, pivotIndex, compare)
    if (k === pivotIndex) {
      return array[k]
    }
    if (k < pivotIndex) {
      rightIndex = pivotIndex - 1
    } else {
      leftIndex = pivotIndex + 1
    }
  }
}

/**
 * Selects the k-th smallest element using quickselect recursion algorithm.
 * @param array - The array to select from.
 * @param k - The index of the element to select.
 * @param leftIndex - The left boundary index.
 * @param rightIndex - The right boundary index.
 * @param compare - The comparison function.
 * @param pivotIndexSelect - The pivot selection function.
 * @returns The k-th smallest element.
 */
function selectRecursion (
  array,
  k,
  leftIndex,
  rightIndex,
  compare = defaultComparator,
  pivotIndexSelect = defaultPivotIndexSelect
) {
  if (leftIndex === rightIndex) return array[leftIndex]
  let pivotIndex = pivotIndexSelect(leftIndex, rightIndex)
  pivotIndex = partition(array, leftIndex, rightIndex, pivotIndex, compare)
  if (k === pivotIndex) {
    return array[k]
  }
  if (k < pivotIndex) {
    return selectRecursion(array, k, leftIndex, pivotIndex - 1, compare)
  }
  return selectRecursion(array, k, pivotIndex + 1, rightIndex, k, compare)
}

/**
 * Swaps two elements in an array.
 * @param array - The array containing elements to swap.
 * @param index1 - The index of the first element.
 * @param index2 - The index of the second element.
 */
function swap (array, index1, index2) {
  const tmp = array[index1]
  array[index1] = array[index2]
  array[index2] = tmp
}

group('Least used worker tasks distribution', () => {
  bench('Loop select', () => {
    loopSelect(tasksMap)
  })
  bench('Array sort select', () => {
    arraySortSelect(tasksMap)
  })
  bench('Quick select loop', () => {
    quickSelectLoop(tasksMap)
  })
  bench('Quick select loop with random pivot', () => {
    quickSelectLoopRandomPivot(tasksMap)
  })
  bench('Quick select recursion', () => {
    quickSelectRecursion(tasksMap)
  })
  bench('Quick select recursion with random pivot', () => {
    quickSelectRecursionRandomPivot(tasksMap)
  })
})

await run({ units: true })
