import { ThreadWorker } from 'poolifier'
import functionToBench from '../../functions/function-to-bench.mjs'
export default new ThreadWorker(functionToBench)
