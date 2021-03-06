const Benchmark = require('benchmark')

const suite = new Benchmark.Suite()

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction'
})

function generateRandomInteger (max, min = 0) {
  if (min) {
    return Math.floor(Math.random() * (max - min + 1) + min)
  }
  return Math.floor(Math.random() * max + 1)
}

const tasksMap = new Map([
  [0, generateRandomInteger(10)],
  [1, generateRandomInteger(10)],
  [2, generateRandomInteger(10)],
  [3, generateRandomInteger(10)],
  [4, generateRandomInteger(10)],
  [5, generateRandomInteger(10)],
  [6, generateRandomInteger(10)],
  [7, generateRandomInteger(10)],
  [8, generateRandomInteger(10)],
  [9, generateRandomInteger(10)],
  [10, generateRandomInteger(10)],
  [11, generateRandomInteger(10)],
  [12, generateRandomInteger(10)],
  [13, generateRandomInteger(10)],
  [14, generateRandomInteger(10)],
  [15, generateRandomInteger(10)],
  [16, generateRandomInteger(10)],
  [17, generateRandomInteger(10)],
  [18, generateRandomInteger(10)],
  [19, generateRandomInteger(10)],
  [20, generateRandomInteger(10)],
  [21, generateRandomInteger(10)],
  [22, generateRandomInteger(10)],
  [23, generateRandomInteger(10)],
  [24, generateRandomInteger(10)],
  [25, generateRandomInteger(10)],
  [26, generateRandomInteger(10)],
  [27, generateRandomInteger(10)],
  [28, generateRandomInteger(10)],
  [29, generateRandomInteger(10)]
])

function loopSelect (tasksMap) {
  let minValue = Infinity
  let minKey
  for (const [key, value] of tasksMap) {
    if (value === 0) {
      return key
    } else if (value < minValue) {
      minKey = key
      minValue = value
    }
  }
  return [minKey, minValue]
}

const defaultComparator = (a, b) => {
  return a < b
}

function swap (array, index1, index2) {
  const tmp = array[index1]
  array[index1] = array[index2]
  array[index2] = tmp
}

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
  for (let i = leftIndex; i < rightIndex; i += 1) {
    if (compare(array[i], pivotValue)) {
      swap(array, storeIndex, i)
      storeIndex += 1
    }
  }
  swap(array, rightIndex, storeIndex)
  return storeIndex
}

function selectLoop (
  array,
  k,
  leftIndex,
  rightIndex,
  compare = defaultComparator
) {
  while (true) {
    if (leftIndex === rightIndex) return array[leftIndex]
    let pivotIndex = leftIndex + Math.floor((rightIndex - leftIndex) / 2)
    pivotIndex = partition(array, leftIndex, rightIndex, pivotIndex, compare)
    if (k === pivotIndex) {
      return array[k]
    } else if (k < pivotIndex) {
      rightIndex = pivotIndex - 1
    } else {
      leftIndex = pivotIndex + 1
    }
  }
}

function selectRecursion (
  array,
  k,
  leftIndex,
  rightIndex,
  compare = defaultComparator
) {
  if (leftIndex === rightIndex) return array[leftIndex]
  let pivotIndex = leftIndex + Math.floor((rightIndex - leftIndex) / 2)
  pivotIndex = partition(array, leftIndex, rightIndex, pivotIndex, compare)
  if (k === pivotIndex) {
    return array[k]
  } else if (k < pivotIndex) {
    return selectRecursion(array, k, leftIndex, pivotIndex - 1, compare)
  } else {
    return selectRecursion(array, k, pivotIndex + 1, rightIndex, k, compare)
  }
}

function quickSelectLoop (tasksMap) {
  const tasksArray = Array.from(tasksMap)

  return selectLoop(tasksArray, 0, 0, tasksArray.length - 1, (a, b) => {
    return a[1] < b[1]
  })
}

function quickSelectRecursion (tasksMap) {
  const tasksArray = Array.from(tasksMap)

  return selectRecursion(tasksArray, 0, 0, tasksArray.length - 1, (a, b) => {
    return a[1] < b[1]
  })
}

// console.log(Array.from(tasksMap))
// console.log(loopSelect(tasksMap))
// console.log(quickSelectLoop(tasksMap))
// console.log(quickSelectRecursion(tasksMap))

suite
  .add('Loop select', function () {
    loopSelect(tasksMap)
  })
  .add('Quick select loop', function () {
    quickSelectLoop(tasksMap)
  })
  .add('Quick select recursion', function () {
    quickSelectRecursion(tasksMap)
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
