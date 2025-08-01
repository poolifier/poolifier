import type { TaskFunctionObject } from './task-functions.js'

import {
  checkValidPriority,
  checkValidWorkerChoiceStrategy,
} from '../pools/utils.js'
import { isPlainObject } from '../utils.js'
import { KillBehaviors, type WorkerOptions } from './worker-options.js'

export const checkValidWorkerOptions = (
  opts: undefined | WorkerOptions
): void => {
  if (opts != null && !isPlainObject(opts)) {
    throw new TypeError('opts worker options parameter is not a plain object')
  }
  if (
    opts?.killBehavior != null &&
    !Object.values(KillBehaviors).includes(opts.killBehavior)
  ) {
    throw new TypeError(
      `killBehavior option '${opts.killBehavior}' is not valid`
    )
  }
  if (
    opts?.maxInactiveTime != null &&
    (!Number.isSafeInteger(opts.maxInactiveTime) || opts.maxInactiveTime < 5)
  ) {
    throw new TypeError(
      'maxInactiveTime option is not a positive integer greater or equal than 5'
    )
  }
  if (opts?.killHandler != null && typeof opts.killHandler !== 'function') {
    throw new TypeError('killHandler option is not a function')
  }
}

export const checkValidTaskFunctionObjectEntry = <
  Data = unknown,
  Response = unknown
>(
    name: string,
    fnObj: TaskFunctionObject<Data, Response>
  ): void => {
  checkTaskFunctionName(name)
  if (typeof fnObj.taskFunction !== 'function') {
    throw new TypeError(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `taskFunction object 'taskFunction' property '${fnObj.taskFunction}' is not a function`
    )
  }
  checkValidPriority(fnObj.priority)
  checkValidWorkerChoiceStrategy(fnObj.strategy)
}

export const checkTaskFunctionName = (name: string): void => {
  if (typeof name !== 'string') {
    throw new TypeError('name parameter is not a string')
  }
  if (name.trim().length === 0) {
    throw new TypeError('name parameter is an empty string')
  }
}
