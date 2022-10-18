// IMPORT LIBRARIES
const { ThreadPool } = require('threadwork')
// FINISH IMPORT LIBRARIES
// IMPORT FUNCTION TO BENCH
const functionToBench = require('./functions/function-to-bench')
// FINISH IMPORT FUNCTION TO BENCH
const size = Number(process.env.POOL_SIZE)

module.exports = new ThreadPool({ task: functionToBench, size })
