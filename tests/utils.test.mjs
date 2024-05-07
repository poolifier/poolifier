import { randomInt } from 'node:crypto'
import os from 'node:os'

import { expect } from 'expect'

import { KillBehaviors } from '../lib/index.cjs'
import {
  availableParallelism,
  average,
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  exponentialDelay,
  isAsyncFunction,
  isKillBehavior,
  isPlainObject,
  max,
  median,
  min,
  // once,
  round,
  secureRandom,
  sleep
} from '../lib/utils.cjs'

describe('Utils test suite', () => {
  it('Verify DEFAULT_TASK_NAME value', () => {
    expect(DEFAULT_TASK_NAME).toBe('default')
  })

  it('Verify EMPTY_FUNCTION value', () => {
    expect(EMPTY_FUNCTION).toStrictEqual(expect.any(Function))
  })

  it('Verify availableParallelism() behavior', () => {
    const parallelism = availableParallelism()
    expect(typeof parallelism === 'number').toBe(true)
    expect(Number.isSafeInteger(parallelism)).toBe(true)
    let expectedParallelism = 1
    try {
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      expectedParallelism = os.availableParallelism()
    } catch {
      expectedParallelism = os.cpus().length
    }
    expect(parallelism).toBe(expectedParallelism)
  })

  it('Verify sleep() behavior', async () => {
    const start = performance.now()
    const sleepMs = 1000
    await sleep(sleepMs)
    const elapsed = performance.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(sleepMs - 1)
  })

  it('Verify exponentialDelay() behavior', () => {
    const delay = exponentialDelay(randomInt(1000))
    expect(typeof delay === 'number').toBe(true)
    expect(delay).toBeGreaterThanOrEqual(Number.MIN_VALUE)
    expect(delay).toBeLessThanOrEqual(Number.MAX_VALUE)
  })

  it('Verify average() computation', () => {
    expect(average([])).toBe(0)
    expect(average([0.08])).toBe(0.08)
    expect(average([0.25, 4.75, 3.05, 6.04, 1.01, 2.02, 5.03])).toBe(
      3.1642857142857146
    )
    expect(average([0.25, 4.75, 3.05, 6.04, 1.01, 2.02])).toBe(
      2.8533333333333335
    )
  })

  it('Verify median() computation', () => {
    expect(median([])).toBe(0)
    expect(median([0.08])).toBe(0.08)
    expect(median([0.25, 4.75, 3.05, 6.04, 1.01, 2.02, 5.03])).toBe(3.05)
    expect(median([0.25, 4.75, 3.05, 6.04, 1.01, 2.02])).toBe(2.535)
  })

  it('Verify round() behavior', () => {
    expect(round(0)).toBe(0)
    expect(round(0.5, 0)).toBe(1)
    expect(round(0.5)).toBe(0.5)
    expect(round(-0.5, 0)).toBe(-1)
    expect(round(-0.5)).toBe(-0.5)
    expect(round(1.005)).toBe(1.01)
    expect(round(2.175)).toBe(2.18)
    expect(round(5.015)).toBe(5.02)
    expect(round(-1.005)).toBe(-1.01)
    expect(round(-2.175)).toBe(-2.18)
    expect(round(-5.015)).toBe(-5.02)
  })

  it('Verify isPlainObject() behavior', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject(true)).toBe(false)
    expect(isPlainObject(false)).toBe(false)
    expect(isPlainObject(0)).toBe(false)
    expect(isPlainObject('')).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(() => {})).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(new RegExp())).toBe(false)
    expect(isPlainObject(new Error())).toBe(false)
    expect(isPlainObject(new Map())).toBe(false)
    expect(isPlainObject(new Set())).toBe(false)
    expect(isPlainObject(new WeakMap())).toBe(false)
    expect(isPlainObject(new WeakSet())).toBe(false)
    expect(isPlainObject(new Int8Array())).toBe(false)
    expect(isPlainObject(new Uint8Array())).toBe(false)
    expect(isPlainObject(new Uint8ClampedArray())).toBe(false)
    expect(isPlainObject(new Int16Array())).toBe(false)
    expect(isPlainObject(new Uint16Array())).toBe(false)
    expect(isPlainObject(new Int32Array())).toBe(false)
    expect(isPlainObject(new Uint32Array())).toBe(false)
    expect(isPlainObject(new Float32Array())).toBe(false)
    expect(isPlainObject(new Float64Array())).toBe(false)
    expect(isPlainObject(new BigInt64Array())).toBe(false)
    expect(isPlainObject(new BigUint64Array())).toBe(false)
    expect(isPlainObject(new Promise(() => {}))).toBe(false)
    expect(isPlainObject(new WeakRef({}))).toBe(false)
    expect(isPlainObject(new FinalizationRegistry(() => {}))).toBe(false)
    expect(isPlainObject(new ArrayBuffer())).toBe(false)
    expect(isPlainObject(new SharedArrayBuffer())).toBe(false)
    expect(isPlainObject(new DataView(new ArrayBuffer()))).toBe(false)
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
  })

  it('Verify isKillBehavior() behavior', () => {
    expect(isKillBehavior(KillBehaviors.SOFT, KillBehaviors.SOFT)).toBe(true)
    expect(isKillBehavior(KillBehaviors.SOFT, KillBehaviors.HARD)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD, KillBehaviors.HARD)).toBe(true)
    expect(isKillBehavior(KillBehaviors.HARD, KillBehaviors.SOFT)).toBe(false)
    expect(isKillBehavior(KillBehaviors.SOFT)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD, null)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD, undefined)).toBe(false)
    expect(isKillBehavior(KillBehaviors.SOFT, 'unknown')).toBe(false)
  })

  it('Verify isAsyncFunction() behavior', () => {
    expect(isAsyncFunction(null)).toBe(false)
    expect(isAsyncFunction(undefined)).toBe(false)
    expect(isAsyncFunction(true)).toBe(false)
    expect(isAsyncFunction(false)).toBe(false)
    expect(isAsyncFunction(0)).toBe(false)
    expect(isAsyncFunction('')).toBe(false)
    expect(isAsyncFunction([])).toBe(false)
    expect(isAsyncFunction(new Date())).toBe(false)
    // eslint-disable-next-line prefer-regex-literals
    expect(isAsyncFunction(new RegExp('[a-z]', 'i'))).toBe(false)
    expect(isAsyncFunction(new Error())).toBe(false)
    expect(isAsyncFunction(new Map())).toBe(false)
    expect(isAsyncFunction(new Set())).toBe(false)
    expect(isAsyncFunction(new WeakMap())).toBe(false)
    expect(isAsyncFunction(new WeakSet())).toBe(false)
    expect(isAsyncFunction(new Int8Array())).toBe(false)
    expect(isAsyncFunction(new Uint8Array())).toBe(false)
    expect(isAsyncFunction(new Uint8ClampedArray())).toBe(false)
    expect(isAsyncFunction(new Int16Array())).toBe(false)
    expect(isAsyncFunction(new Uint16Array())).toBe(false)
    expect(isAsyncFunction(new Int32Array())).toBe(false)
    expect(isAsyncFunction(new Uint32Array())).toBe(false)
    expect(isAsyncFunction(new Float32Array())).toBe(false)
    expect(isAsyncFunction(new Float64Array())).toBe(false)
    expect(isAsyncFunction(new BigInt64Array())).toBe(false)
    expect(isAsyncFunction(new BigUint64Array())).toBe(false)
    expect(isAsyncFunction(new Promise(() => {}))).toBe(false)
    expect(isAsyncFunction(new WeakRef({}))).toBe(false)
    expect(isAsyncFunction(new FinalizationRegistry(() => {}))).toBe(false)
    expect(isAsyncFunction(new ArrayBuffer(16))).toBe(false)
    expect(isAsyncFunction(new SharedArrayBuffer(16))).toBe(false)
    expect(isAsyncFunction(new DataView(new ArrayBuffer(16)))).toBe(false)
    expect(isAsyncFunction({})).toBe(false)
    expect(isAsyncFunction({ a: 1 })).toBe(false)
    expect(isAsyncFunction(() => {})).toBe(false)
    expect(isAsyncFunction(function () {})).toBe(false)
    expect(isAsyncFunction(function named () {})).toBe(false)
    expect(isAsyncFunction(async () => {})).toBe(true)
    expect(isAsyncFunction(async function () {})).toBe(true)
    expect(isAsyncFunction(async function named () {})).toBe(true)
    class TestClass {
      testSync () {}
      async testAsync () {}
      testArrowSync = () => {}
      testArrowAsync = async () => {}
      static testStaticSync () {}
      static async testStaticAsync () {}
    }
    const testClass = new TestClass()
    expect(isAsyncFunction(testClass.testSync)).toBe(false)
    expect(isAsyncFunction(testClass.testAsync)).toBe(true)
    expect(isAsyncFunction(testClass.testArrowSync)).toBe(false)
    expect(isAsyncFunction(testClass.testArrowAsync)).toBe(true)
    expect(isAsyncFunction(TestClass.testStaticSync)).toBe(false)
    expect(isAsyncFunction(TestClass.testStaticAsync)).toBe(true)
  })

  it('Verify secureRandom() behavior', () => {
    const randomNumber = secureRandom()
    expect(typeof randomNumber === 'number').toBe(true)
    expect(randomNumber).toBeGreaterThanOrEqual(0)
    expect(randomNumber).toBeLessThan(1)
  })

  it('Verify min() behavior', () => {
    expect(min()).toBe(Infinity)
    expect(min(1, 2)).toBe(1)
    expect(min(2, 1)).toBe(1)
    expect(min(1, 1)).toBe(1)
  })

  it('Verify max() behavior', () => {
    expect(max()).toBe(-Infinity)
    expect(max(1, 2)).toBe(2)
    expect(max(2, 1)).toBe(2)
    expect(max(1, 1)).toBe(1)
  })

  // it('Verify once() behavior', () => {
  //   let called = 0
  //   const fn = () => ++called
  //   const onceFn = once(fn, this)
  //   const result1 = onceFn()
  //   expect(called).toBe(1)
  //   expect(result1).toBe(1)
  //   const result2 = onceFn()
  //   expect(called).toBe(1)
  //   expect(result2).toBe(1)
  //   const result3 = onceFn()
  //   expect(called).toBe(1)
  //   expect(result3).toBe(1)
  // })
})
