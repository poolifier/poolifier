import { KillBehaviors, ThreadWorker } from '../../../lib/index.cjs'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} from '../../test-utils.cjs'

export default new ThreadWorker(
  {
    factorial: data => factorial(data.n),
    fibonacci: data => fibonacci(data.n),
    jsonIntegerSerialization: data => jsonIntegerSerialization(data.n),
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  }
)
