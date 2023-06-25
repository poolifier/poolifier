import { expose } from 'threads/worker'
import functionToBench from '../../functions/function-to-bench.mjs'

expose({
  exposedFunction (data) {
    return functionToBench(data)
  }
})
