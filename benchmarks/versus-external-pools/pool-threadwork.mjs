// IMPORT LIBRARIES
import { ThreadPool } from 'threadwork'
// FINISH IMPORT LIBRARIES
// IMPORT FUNCTION TO BENCH
import functionToBench from './functions/function-to-bench.mjs'
// FINISH IMPORT FUNCTION TO BENCH
const size = parseInt(process.env.POOL_SIZE)

export default new ThreadPool({ task: functionToBench, size })
