import { KillBehaviors, ThreadWorker } from '../../../lib/index.js'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization
} from '../../test-utils.js'

export default new ThreadWorker(
  {
    jsonIntegerSerialization: data => jsonIntegerSerialization(data.n),
    factorial: data => factorial(data.n),
    fibonacci: data => fibonacci(data.n)
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500
  }
)
