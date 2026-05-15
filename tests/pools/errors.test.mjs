import { describe, expect, it } from 'vitest'

import {
  WorkerCrashError as WorkerCrashErrorCjs,
  WorkerTerminationError as WorkerTerminationErrorCjs,
} from '../../lib/index.cjs'
import { WorkerCrashError, WorkerTerminationError } from '../../lib/index.mjs'

describe('Pool error classes test suite', () => {
  describe('WorkerCrashError', () => {
    it('builds with no options', () => {
      const e = new WorkerCrashError('boom')
      expect(e).toBeInstanceOf(Error)
      expect(e).toBeInstanceOf(WorkerCrashError)
      expect(e.name).toBe('WorkerCrashError')
      expect(e.message).toBe('boom')
      expect(e.exitCode).toBeNull()
      expect(e.signal).toBeNull()
      expect(e.taskId).toBeUndefined()
      expect(e.workerId).toBeUndefined()
      expect(e.cause).toBeUndefined()
    })
    it('builds with all options', () => {
      const cause = new Error('inner')
      const taskId = '11111111-2222-3333-4444-555555555555'
      const e = new WorkerCrashError('boom', {
        cause,
        exitCode: 1,
        signal: 'SIGKILL',
        taskId,
        workerId: 7,
      })
      expect(e.name).toBe('WorkerCrashError')
      expect(e.message).toBe('boom')
      expect(e.exitCode).toBe(1)
      expect(e.signal).toBe('SIGKILL')
      expect(e.taskId).toBe(taskId)
      expect(e.workerId).toBe(7)
      expect(e.cause).toBe(cause)
    })
    it('builds with cause only', () => {
      const cause = new Error('inner')
      const e = new WorkerCrashError('wrap', { cause })
      expect(e.cause).toBe(cause)
      expect(e.exitCode).toBeNull()
      expect(e.signal).toBeNull()
    })
    it('handles cause: undefined explicitly', () => {
      const e = new WorkerCrashError('boom', {
        cause: undefined,
        exitCode: 2,
      })
      expect(e.cause).toBeUndefined()
      expect(e.exitCode).toBe(2)
    })
    it('handles signal-only (exitCode normalised to null)', () => {
      const e = new WorkerCrashError('signal', { signal: 'SIGSEGV' })
      expect(e.exitCode).toBeNull()
      expect(e.signal).toBe('SIGSEGV')
    })
    it('resists name tampering (Object.assign attempt)', () => {
      const e = new WorkerCrashError('boom')
      // Object.assign on a non-writable property throws in strict mode but
      // the .mjs test file is not strict-by-default — defineProperty makes
      // it non-writable+non-configurable so the assign is silently a no-op
      // in sloppy mode, and the discrimination contract holds either way.
      try {
        Object.assign(e, { name: 'fake' })
      } catch {
        // strict-mode TypeError — acceptable
      }
      expect(e.name).toBe('WorkerCrashError')
    })
    it('resists name tampering (defineProperty attempt)', () => {
      const e = new WorkerCrashError('boom')
      expect(() => {
        Object.defineProperty(e, 'name', { value: 'fake' })
      }).toThrow()
      expect(e.name).toBe('WorkerCrashError')
    })
    it('preserves stack trace', () => {
      const e = new WorkerCrashError('boom')
      expect(typeof e.stack).toBe('string')
    })
  })

  describe('WorkerTerminationError', () => {
    it('builds with no options', () => {
      const e = new WorkerTerminationError('terminating')
      expect(e).toBeInstanceOf(Error)
      expect(e).toBeInstanceOf(WorkerTerminationError)
      expect(e.name).toBe('WorkerTerminationError')
      expect(e.message).toBe('terminating')
      expect(e.taskId).toBeUndefined()
      expect(e.workerId).toBeUndefined()
      expect(e.cause).toBeUndefined()
    })
    it('builds with all options', () => {
      const cause = new Error('inner')
      const taskId = '11111111-2222-3333-4444-555555555555'
      const e = new WorkerTerminationError('terminate', {
        cause,
        taskId,
        workerId: 9,
      })
      expect(e.name).toBe('WorkerTerminationError')
      expect(e.taskId).toBe(taskId)
      expect(e.workerId).toBe(9)
      expect(e.cause).toBe(cause)
    })
    it('builds with cause only', () => {
      const cause = new Error('inner')
      const e = new WorkerTerminationError('wrap', { cause })
      expect(e.cause).toBe(cause)
      expect(e.taskId).toBeUndefined()
    })
    it('resists name tampering', () => {
      const e = new WorkerTerminationError('boom')
      expect(() => {
        Object.defineProperty(e, 'name', { value: 'fake' })
      }).toThrow()
      expect(e.name).toBe('WorkerTerminationError')
    })
  })

  describe('Dual-package (CJS / ESM) interop', () => {
    it('discriminates via error.name across bundles', () => {
      const eMjs = new WorkerCrashError('boom')
      const eCjs = new WorkerCrashErrorCjs('boom')
      expect(eMjs.name).toBe('WorkerCrashError')
      expect(eCjs.name).toBe('WorkerCrashError')
      // String-equal discrimination is dual-package safe
      expect(eMjs.name === eCjs.name).toBe(true)
    })
    it('documents instanceof asymmetry across bundles', () => {
      const eCjs = new WorkerCrashErrorCjs('boom')
      // CJS instance is NOT instanceof the ESM class — different realms.
      // This is the documented limitation: discriminate via `name`.
      expect(eCjs instanceof WorkerCrashError).toBe(false)
      expect(eCjs instanceof WorkerCrashErrorCjs).toBe(true)
    })
    it('discriminates WorkerTerminationError across bundles', () => {
      const eMjs = new WorkerTerminationError('t')
      const eCjs = new WorkerTerminationErrorCjs('t')
      expect(eMjs.name).toBe('WorkerTerminationError')
      expect(eCjs.name).toBe('WorkerTerminationError')
    })
  })
})
