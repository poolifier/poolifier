import type { PromiseResponseWrapper } from '../../lib/index.js'

declare const response: PromiseResponseWrapper

export const removedPropertyIsUndefined = (): boolean =>
  response.workerNodeKey === undefined
