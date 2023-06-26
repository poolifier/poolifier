import { ThreadWorker } from 'poolifier'
import functionToBench from '../../functions/function-to-bench.js'
export default new ThreadWorker(functionToBench)
