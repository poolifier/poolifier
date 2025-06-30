import { expect } from '@std/expect'

import { AbortError } from '../../lib/worker/abort-error.cjs'

describe('Abort error test suite', () => {
  it('Verify constructor() behavior', () => {
    const taskId = '1234-5678-90ab-cdef-1234567890ab'
    const errorMessage = 'This is an abort error message'
    const abortError = new AbortError(errorMessage, taskId)

    expect(abortError).toBeInstanceOf(AbortError)
    expect(abortError).toBeInstanceOf(Error)
    expect(abortError.name).toBe('AbortError')
    expect(abortError.message).toBe(errorMessage)
    expect(abortError.stack).toBeDefined()
    expect(abortError.taskId).toBe(taskId)
  })
})
