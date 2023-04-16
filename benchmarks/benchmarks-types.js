const WorkerFunctions = {
  jsonIntegerSerialization: 'jsonIntegerSerialization',
  fibonacci: 'fibonacci',
  factorial: 'factorial',
  readWriteFiles: 'readWriteFiles'
}

const PoolTypes = {
  FIXED: 'fixed',
  DYNAMIC: 'dynamic'
}

const WorkerTypes = {
  THREAD: 'thread',
  CLUSTER: 'cluster'
}

module.exports = { PoolTypes, WorkerFunctions, WorkerTypes }
