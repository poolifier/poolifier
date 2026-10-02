import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { WorkerCrashError, WorkerTerminationError } from '../../lib/index.mjs'
import {
  WorkerCrashError as WorkerCrashErrorCjs,
  WorkerTerminationError as WorkerTerminationErrorCjs,
} from '../../lib/pools/errors.cjs'

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
    it('handles signal-only (exitCode normalized to null)', () => {
      const e = new WorkerCrashError('signal', { signal: 'SIGSEGV' })
      expect(e.exitCode).toBeNull()
      expect(e.signal).toBe('SIGSEGV')
    })
    it('resists name tampering (Object.assign attempt)', () => {
      const e = new WorkerCrashError('boom')
      // Object.assign on a non-writable name property: silently no-op
      // (sloppy mode) or TypeError (strict mode). Both are acceptable —
      // the discrimination contract holds either way.
      expect(() => Object.assign(e, { name: 'fake' })).toThrow(TypeError)
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
    it('loads error classes from the public CJS root', () => {
      const child = spawnSync(
        process.execPath,
        [
          '--input-type=commonjs',
          '--eval',
          "const { WorkerCrashError, WorkerTerminationError } = require('./lib/index.cjs'); process.stdout.write(JSON.stringify({ crash: new WorkerCrashError('c').name, termination: new WorkerTerminationError('t').name }))",
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      )
      expect(child.error).toBeUndefined()
      expect(child.signal).toBeNull()
      expect(child.status).toBe(0)
      expect(child.stderr).toBe('')
      expect(JSON.parse(child.stdout)).toStrictEqual({
        crash: 'WorkerCrashError',
        termination: 'WorkerTerminationError',
      })
    })
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
