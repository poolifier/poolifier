import { expose } from 'threads/worker'
import functionToBench from '../../functions/function-to-bench.js'

expose({
  exposedFunction (data) {
    return functionToBench(data)
  }
})
