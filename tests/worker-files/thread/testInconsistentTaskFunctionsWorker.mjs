import { threadId } from 'node:worker_threads'

import { ThreadWorker } from '../../../lib/index.mjs'

const taskFunctions =
  threadId % 2 === 0 ? { alternate: data => data } : { primary: data => data }

export default new ThreadWorker(taskFunctions)
