import { ClusterWorker, KillBehaviors } from '../../../lib/index.mjs'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} from '../../test-utils.cjs'

export default new ClusterWorker(
  {
    factorial: { taskFunction: data => factorial(data.n) },
    fibonacci: { priority: -5, taskFunction: data => fibonacci(data.n) },
    jsonIntegerSerialization: {
      taskFunction: data => jsonIntegerSerialization(data.n),
    },
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  }
)
