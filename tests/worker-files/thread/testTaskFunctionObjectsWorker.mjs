import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization
} from '../../test-utils.cjs'

export default new ThreadWorker(
  {
    jsonIntegerSerialization: {
      taskFunction: data => jsonIntegerSerialization(data.n)
    },
    factorial: { taskFunction: data => factorial(data.n) },
    fibonacci: { taskFunction: data => fibonacci(data.n), priority: -5 }
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500
  }
)
