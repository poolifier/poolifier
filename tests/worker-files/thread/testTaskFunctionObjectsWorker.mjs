import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
// import { TaskFunctions } from '../../test-types.cjs'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization
} from '../../test-utils.cjs'

export default new ThreadWorker(
  {
    jsonIntegerSerialization: {
      taskFunction: data => jsonIntegerSerialization(data.n),
      priority: -10,
      workerNodes: [0]
    },
    factorial: { taskFunction: data => factorial(data.n) },
    fibonacci: { taskFunction: data => fibonacci(data.n) }
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500
  }
)
