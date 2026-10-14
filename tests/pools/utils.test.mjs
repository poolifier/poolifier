import { Worker as ClusterWorker } from 'node:cluster'
import { PassThrough } from 'node:stream'
import { SHARE_ENV, Worker as ThreadWorker } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'

import { CircularBuffer } from '../../lib/circular-buffer.mjs'
import { WorkerTypes } from '../../lib/index.mjs'
import {
  buildClusterSettings,
  buildClusterWorkerEnvironment,
  buildThreadWorkerOptions,
  checkValidWorkerNodeKeys,
  createWorker,
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  getDefaultTasksQueueOptions,
  initWorkerInfo,
  updateMeasurementStatistics,
  validateAndMaterializeClusterStdio,
} from '../../lib/pools/utils.mjs'
import { MeasurementHistorySize } from '../../lib/pools/worker.mjs'

describe('Pool utils test suite', () => {
  it('Verify DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS values', () => {
    expect(DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS).toStrictEqual({
      aggregate: false,
      average: false,
      median: false,
    })
  })

  it('Verify getDefaultTasksQueueOptions() behavior', () => {
    const poolMaxSize = 4
    expect(getDefaultTasksQueueOptions(poolMaxSize)).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 1,
      loadExponent: 0.6666666666666666,
      size: poolMaxSize ** 2,
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
  })

  it('builds cluster worker environments from own properties', () => {
    const inheritedEnvironment = { INHERITED_SOURCE_KEY: 'inherited' }
    const processEnvironment = Object.assign(
      Object.create(inheritedEnvironment),
      {
        BASE_KEY: 'base',
        OVERRIDDEN_KEY: 'base',
      }
    )
    const workerEnvironment = Object.assign(
      Object.create(inheritedEnvironment),
      {
        OVERRIDDEN_KEY: 'worker',
        WORKER_KEY: 'worker',
      }
    )
    const pollutionKey = 'POOLIFIER_ARBITRARY_ENV_POLLUTION'
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, pollutionKey, {
      configurable: true,
      enumerable: true,
      value: 'polluted',
      writable: true,
    })
    try {
      const environment = buildClusterWorkerEnvironment(
        processEnvironment,
        workerEnvironment,
        false
      )
      expect(Object.getPrototypeOf(environment)).toBeNull()
      expect(environment).toMatchObject({
        BASE_KEY: 'base',
        OVERRIDDEN_KEY: 'worker',
        WORKER_KEY: 'worker',
      })
      expect(Object.hasOwn(environment, 'INHERITED_SOURCE_KEY')).toBe(false)
      expect(Object.hasOwn(environment, pollutionKey)).toBe(true)
      expect(environment[pollutionKey]).toBeUndefined()
    } finally {
      Reflect.deleteProperty(Object.prototype, pollutionKey)
    }
  })

  it('preserves explicit Windows environment precedence by logical key', () => {
    const processEnvironment = {
      NODE_OPTIONS: '--no-deprecation',
      PATH: 'base-path',
    }
    const environment = buildClusterWorkerEnvironment(
      processEnvironment,
      {
        node_options: '--no-warnings',
        path: 'worker-path',
      },
      true
    )
    expect(Object.getPrototypeOf(environment)).toBeNull()
    expect(
      Object.keys(environment).filter(
        key => key.toUpperCase() === 'NODE_OPTIONS'
      )
    ).toStrictEqual(['NODE_OPTIONS'])
    expect(environment.NODE_OPTIONS).toBe('--no-warnings')
    expect(
      Object.keys(environment).filter(key => key.toUpperCase() === 'PATH')
    ).toStrictEqual(['PATH'])
    expect(environment.PATH).toBe('worker-path')

    const environmentWithRemovedOption = buildClusterWorkerEnvironment(
      processEnvironment,
      { node_options: undefined },
      true
    )
    expect(Object.hasOwn(environmentWithRemovedOption, 'NODE_OPTIONS')).toBe(
      true
    )
    expect(environmentWithRemovedOption.NODE_OPTIONS).toBeUndefined()
    expect(Object.hasOwn(environmentWithRemovedOption, 'node_options')).toBe(
      false
    )
  })

  it('uses Object.prototype keys to mask Windows environment variants', () => {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, 'NODE_OPTIONS', {
      configurable: true,
      enumerable: true,
      value: undefined,
      writable: true,
    })
    try {
      const environment = buildClusterWorkerEnvironment(
        { node_options: '--no-deprecation' },
        undefined,
        true
      )
      expect(Object.keys(environment)).toStrictEqual(['NODE_OPTIONS'])
      expect(environment.NODE_OPTIONS).toBe('--no-deprecation')
    } finally {
      Reflect.deleteProperty(Object.prototype, 'NODE_OPTIONS')
    }
  })

  it('builds cluster settings with safe optional shadows and precedence', () => {
    const execArgv = ['--no-warnings']
    const stdio = ['ignore', 'pipe', 'pipe', 'ipc']
    const settings = buildClusterSettings(
      {
        cwd: '/current',
        exec: './current.cjs',
        execArgv: ['--trace-warnings'],
        silent: true,
      },
      {
        cwd: '/explicit',
        exec: './ignored.cjs',
        execArgv,
        stdio,
      },
      './worker.cjs'
    )
    expect(Object.getPrototypeOf(settings)).toBeNull()
    expect(settings).toMatchObject({
      cwd: '/explicit',
      exec: './worker.cjs',
      execArgv,
      silent: true,
    })
    expect(settings.execArgv).not.toBe(execArgv)
    expect(settings.stdio).not.toBe(stdio)
    expect(Array.isArray(settings.stdio)).toBe(true)
    expect(Object.getPrototypeOf(settings.stdio)).toBe(Array.prototype)
    expect([...settings.stdio]).toStrictEqual(stdio)
    expect(settings.stdio.map(value => value)).toStrictEqual(stdio)
    expect(settings.stdio.length).toBe(stdio.length)
    for (let index = 0; index < stdio.length; index++) {
      expect(Object.hasOwn(settings.stdio, index)).toBe(true)
      expect(settings.stdio[index]).toBe(stdio[index])
    }
    for (const key of [
      'cwd',
      'serialization',
      'windowsHide',
      'stdio',
      'gid',
      'uid',
      'inspectPort',
    ]) {
      expect(Object.hasOwn(settings, key)).toBe(true)
    }
  })

  it('builds thread worker options without cloning opaque values', () => {
    const workerData = { value: true }
    const execArgv = ['--no-warnings']
    const workerOptions = buildThreadWorkerOptions({ execArgv, workerData })
    expect(Object.getPrototypeOf(workerOptions)).toBeNull()
    expect(workerOptions.env).toBe(SHARE_ENV)
    expect(workerOptions.workerData).toBe(workerData)
    expect(workerOptions.execArgv).toStrictEqual(execArgv)
    expect(workerOptions.execArgv).not.toBe(execArgv)
  })

  it('normalizes worker option arrays and resource limits by own slots', () => {
    const argvValue = { value: 'argv' }
    const argv = new Array(2)
    argv[1] = argvValue
    const transferable = new ArrayBuffer(8)
    const transferList = new Array(2)
    transferList[1] = transferable
    const inheritedResourceLimits = { maxYoungGenerationSizeMb: 1 }
    const resourceLimits = Object.create(inheritedResourceLimits)
    Object.defineProperty(resourceLimits, 'maxOldGenerationSizeMb', {
      value: 32,
    })
    const workerData = { value: 'workerData' }

    const workerOptions = buildThreadWorkerOptions({
      argv,
      resourceLimits,
      transferList,
      workerData,
    })

    expect(Object.getPrototypeOf(workerOptions.argv)).toBeNull()
    expect(workerOptions.argv).not.toBe(argv)
    expect(Object.hasOwn(workerOptions.argv, 0)).toBe(false)
    expect(workerOptions.argv[1]).toBe(argvValue)
    expect(workerOptions.transferList).not.toBe(transferList)
    expect(Object.hasOwn(workerOptions.transferList, 0)).toBe(true)
    expect(workerOptions.transferList[0]).toBeUndefined()
    expect(workerOptions.transferList[1]).toBe(transferable)
    expect(Object.getPrototypeOf(workerOptions.resourceLimits)).toBeNull()
    expect(
      Object.hasOwn(workerOptions.resourceLimits, 'maxYoungGenerationSizeMb')
    ).toBe(false)
    expect(workerOptions.resourceLimits.maxOldGenerationSizeMb).toBe(32)
    expect(workerOptions.workerData).toBe(workerData)
  })

  it('normalizes cluster positional arrays without reading inherited slots', () => {
    const args = new Array(2)
    args[1] = '--worker-argument'
    const accessor = Symbol('accessor')
    let accessorCalls = 0
    const descriptor = {}
    const accessorGetter = () => {
      accessorCalls++
      return 'accessor-value'
    }
    Object.defineProperties(descriptor, {
      [accessor]: {
        configurable: true,
        enumerable: true,
        get: accessorGetter,
      },
      custom: {
        value: 'descriptor-value',
      },
    })
    const opaqueStream = new PassThrough()
    const stdio = new Array(4)
    stdio[0] = descriptor
    stdio[1] = opaqueStream
    stdio[3] = 'ipc'

    const settings = buildClusterSettings(
      { exec: './current.cjs' },
      { args, stdio },
      './worker.cjs'
    )
    const accessorCallsAfterBuild = accessorCalls

    expect(settings.args).not.toBe(args)
    expect(Object.hasOwn(settings.args, 0)).toBe(true)
    expect(settings.args[0]).toBeUndefined()
    expect(settings.args[1]).toBe('--worker-argument')
    expect(Object.getPrototypeOf(settings.stdio)).toBe(Array.prototype)
    expect(Object.hasOwn(settings.stdio, 2)).toBe(true)
    expect(settings.stdio[2]).toBeUndefined()
    expect(settings.stdio[0]).not.toBe(descriptor)
    expect(settings.stdio[1]).toBe(opaqueStream)
    expect(Object.getPrototypeOf(settings.stdio[0])).toBeNull()
    const customDescriptor = Object.getOwnPropertyDescriptor(
      descriptor,
      'custom'
    )
    const clonedCustomDescriptor = Object.getOwnPropertyDescriptor(
      settings.stdio[0],
      'custom'
    )
    expect(clonedCustomDescriptor.configurable).toBe(
      customDescriptor.configurable
    )
    expect(clonedCustomDescriptor.enumerable).toBe(customDescriptor.enumerable)
    expect(clonedCustomDescriptor.value).toBe(customDescriptor.value)
    expect(clonedCustomDescriptor.writable).toBe(customDescriptor.writable)
    const accessorDescriptor = Object.getOwnPropertyDescriptor(
      settings.stdio[0],
      accessor
    )
    expect(accessorDescriptor.configurable).toBe(true)
    expect(accessorDescriptor.enumerable).toBe(true)
    expect(accessorDescriptor.get).toBe(accessorGetter)
    expect(Object.hasOwn(accessorDescriptor, 'set')).toBe(true)
    expect(accessorDescriptor.set).toBeUndefined()
    expect(accessorCallsAfterBuild).toBe(0)
    for (const key of ['fd', 'handle', '_handle']) {
      expect(Object.hasOwn(settings.stdio[0], key)).toBe(true)
      expect(settings.stdio[0][key]).toBeUndefined()
    }
    opaqueStream.destroy()
  })

  it('shadows inherited controls on plain stdio descriptors', () => {
    // eslint-disable-next-line no-extend-native
    Object.defineProperties(Object.prototype, {
      _handle: {
        configurable: true,
        enumerable: true,
        value: 'polluted',
        writable: true,
      },
      handle: {
        configurable: true,
        enumerable: true,
        value: 'polluted',
        writable: true,
      },
    })
    try {
      const settings = buildClusterSettings(
        { exec: './current.cjs' },
        { stdio: [{ fd: 1 }] },
        './worker.cjs'
      )
      expect(settings.stdio[0].fd).toBe(1)
      expect(Object.hasOwn(settings.stdio[0], 'handle')).toBe(true)
      expect(settings.stdio[0].handle).toBeUndefined()
      expect(Object.hasOwn(settings.stdio[0], '_handle')).toBe(true)
      expect(settings.stdio[0]._handle).toBeUndefined()
    } finally {
      Reflect.deleteProperty(Object.prototype, '_handle')
      Reflect.deleteProperty(Object.prototype, 'handle')
    }
  })

  it('accepts numeric stdio fd before irrelevant inherited controls', () => {
    const opaqueStdioEntry = Object.create({})
    Object.defineProperty(opaqueStdioEntry, 'fd', { value: 0 })
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, 'handle', {
      configurable: true,
      enumerable: true,
      value: -1,
      writable: true,
    })
    try {
      expect(() =>
        validateAndMaterializeClusterStdio([opaqueStdioEntry])
      ).not.toThrow()
    } finally {
      Reflect.deleteProperty(Object.prototype, 'handle')
    }
  })

  it('ignores nonnumeric inherited fd before a legitimate handle', () => {
    const handle = {}
    const opaqueStdioEntry = Object.create({ handle })
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, 'fd', {
      configurable: true,
      enumerable: true,
      value: 'polluted',
      writable: true,
    })
    try {
      expect(() =>
        validateAndMaterializeClusterStdio([opaqueStdioEntry])
      ).not.toThrow()
    } finally {
      Reflect.deleteProperty(Object.prototype, 'fd')
    }
  })

  it('rejects inherited stdio accessors without invoking them', () => {
    for (const key of ['fd', 'handle']) {
      let accessorCalls = 0
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Object.prototype, key, {
        configurable: true,
        get: () => {
          accessorCalls++
          return key === 'fd' ? 1 : {}
        },
      })
      try {
        expect(() => validateAndMaterializeClusterStdio([{}])).toThrow(
          new TypeError(
            `Invalid cluster.settings.stdio entry: inherited accessor '${key}' from Object.prototype is not allowed`
          )
        )
        expect(accessorCalls).toBe(0)
      } finally {
        Reflect.deleteProperty(Object.prototype, key)
      }
    }
  })

  it('builds worker options with polluted descriptor fields', () => {
    for (const key of ['get', 'set']) {
      let accessorCalls = 0
      const stdioDescriptor = {}
      const accessor = Symbol('accessor')
      const accessorGetter = () => {
        accessorCalls++
        return 'accessor-value'
      }
      Object.defineProperty(stdioDescriptor, accessor, {
        get: accessorGetter,
      })
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Object.prototype, key, {
        configurable: true,
        value: () => undefined,
        writable: true,
      })
      let buildError
      let clonedAccessorGetter
      let settings
      let workerOptions
      try {
        settings = buildClusterSettings(
          undefined,
          {
            args: new Array(1),
            execArgv: ['--no-warnings'],
            stdio: [stdioDescriptor, 'ignore', 'ignore', 'ipc'],
          },
          './worker.cjs'
        )
        workerOptions = buildThreadWorkerOptions({
          argv: new Array(1),
          execArgv: ['--no-warnings'],
          resourceLimits: { maxOldGenerationSizeMb: 32 },
          transferList: new Array(1),
        })
        clonedAccessorGetter = Object.getOwnPropertyDescriptor(
          settings.stdio[0],
          accessor
        ).get
      } catch (error) {
        buildError = error
      } finally {
        Reflect.deleteProperty(Object.prototype, key)
      }
      expect(buildError).toBeUndefined()
      expect(Object.hasOwn(settings.args, 0)).toBe(true)
      expect(Object.hasOwn(settings.stdio, 0)).toBe(true)
      expect(clonedAccessorGetter).toBe(accessorGetter)
      expect(Object.hasOwn(workerOptions.argv, 0)).toBe(false)
      expect(Object.hasOwn(workerOptions.execArgv, 0)).toBe(true)
      expect(Object.hasOwn(workerOptions.transferList, 0)).toBe(true)
      expect(workerOptions.resourceLimits.maxOldGenerationSizeMb).toBe(32)
      expect(accessorCalls).toBe(0)
    }
  })

  it('leaves invalid non-array execArgv values for Node validation', () => {
    const invalidExecArgv = '--no-warnings'
    expect(
      buildClusterSettings(
        { exec: './current.cjs' },
        { execArgv: invalidExecArgv },
        './worker.cjs'
      ).execArgv
    ).toBe(invalidExecArgv)
    expect(
      buildThreadWorkerOptions({ execArgv: invalidExecArgv }).execArgv
    ).toBe(invalidExecArgv)
  })

  it('leaves invalid non-object resource limits for Node validation', () => {
    const resourceLimits = 'invalid'
    expect(buildThreadWorkerOptions({ resourceLimits }).resourceLimits).toBe(
      resourceLimits
    )
  })

  it('preserves null resource limits for Node runtime defaults', () => {
    expect(
      buildThreadWorkerOptions({ resourceLimits: null }).resourceLimits
    ).toBeNull()
  })

  it('rejects sparse effective execArgv arrays', () => {
    const sparseExecArgv = new Array(1)
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, '0', {
      configurable: true,
      enumerable: true,
      value: '--no-warnings',
      writable: true,
    })
    try {
      expect(() =>
        buildClusterSettings(
          { exec: './current.cjs' },
          { execArgv: sparseExecArgv },
          './worker.cjs'
        )
      ).toThrow(
        new TypeError('Invalid settings.execArgv: must not be a sparse array')
      )
      expect(() =>
        buildThreadWorkerOptions({ execArgv: sparseExecArgv })
      ).toThrow(
        new TypeError(
          'Invalid workerOptions.execArgv: must not be a sparse array'
        )
      )
    } finally {
      Reflect.deleteProperty(Object.prototype, '0')
    }
  })

  it('Verify updateMeasurementStatistics() behavior', () => {
    const measurementStatistics = {
      history: new CircularBuffer(MeasurementHistorySize),
    }
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.01
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.01,
      maximum: 0.01,
      minimum: 0.01,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.02
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.03,
      maximum: 0.02,
      minimum: 0.01,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.001
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.031,
      average: 0.0010000000474974513,
      maximum: 0.02,
      minimum: 0.001,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.003
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.034,
      average: 0.0020000000367872417,
      maximum: 0.02,
      minimum: 0.001,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: true },
      0.006
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.04,
      maximum: 0.02,
      median: 0.003000000026077032,
      minimum: 0.001,
    })
    updateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.01
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.05,
      average: 0.004999999975552782,
      maximum: 0.02,
      minimum: 0.001,
    })
  })

  it('Verify createWorker() behavior', () => {
    expect(
      createWorker(
        WorkerTypes.thread,
        './tests/worker-files/thread/testWorker.mjs',
        {}
      )
    ).toBeInstanceOf(ThreadWorker)
    expect(
      createWorker(
        WorkerTypes.cluster,
        './tests/worker-files/cluster/testWorker.cjs',
        {}
      )
    ).toBeInstanceOf(ClusterWorker)
  })

  it('Verify initWorkerInfo() behavior', () => {
    const threadWorker = createWorker(
      WorkerTypes.thread,
      './tests/worker-files/thread/testWorker.mjs',
      {}
    )
    const threadWorkerInfo = initWorkerInfo(threadWorker)
    expect(threadWorkerInfo).toStrictEqual({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      dynamic: false,
      id: threadWorker.threadId,
      queuedTaskAbortion: false,
      ready: false,
      stealing: false,
      stolen: false,
      type: WorkerTypes.thread,
    })
    const clusterWorker = createWorker(
      WorkerTypes.cluster,
      './tests/worker-files/cluster/testWorker.cjs',
      {}
    )
    const clusterWorkerInfo = initWorkerInfo(clusterWorker)
    expect(clusterWorkerInfo).toMatchObject({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      dynamic: false,
      id: clusterWorker.id,
      queuedTaskAbortion: false,
      ready: false,
      stealing: false,
      stolen: false,
      type: WorkerTypes.cluster,
    })
  })

  it('Verify checkValidWorkerNodeKeys() behavior', () => {
    // Should not throw for undefined
    expect(() => checkValidWorkerNodeKeys(undefined)).not.toThrow()
    // Should not throw for null
    expect(() => checkValidWorkerNodeKeys(null)).not.toThrow()
    // Should not throw for valid array with elements
    expect(() => checkValidWorkerNodeKeys([0, 1, 2])).not.toThrow()
    // Should throw TypeError for non-array
    expect(() => checkValidWorkerNodeKeys('not an array')).toThrow(
      new TypeError('Invalid worker node keys: must be an array')
    )
    expect(() => checkValidWorkerNodeKeys(123)).toThrow(
      new TypeError('Invalid worker node keys: must be an array')
    )
    expect(() => checkValidWorkerNodeKeys({})).toThrow(
      new TypeError('Invalid worker node keys: must be an array')
    )
    // Should throw RangeError for empty array
    expect(() => checkValidWorkerNodeKeys([])).toThrow(
      new RangeError('Invalid worker node keys: must not be an empty array')
    )
    // Should throw TypeError for non-integer values
    expect(() => checkValidWorkerNodeKeys([1.5])).toThrow(
      new TypeError(
        "Invalid worker node key '1.5': must be a non-negative safe integer"
      )
    )
    expect(() => checkValidWorkerNodeKeys([0, 1.5, 2])).toThrow(
      new TypeError(
        "Invalid worker node key '1.5': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for negative values
    expect(() => checkValidWorkerNodeKeys([-1])).toThrow(
      new TypeError(
        "Invalid worker node key '-1': must be a non-negative safe integer"
      )
    )
    expect(() => checkValidWorkerNodeKeys([0, -1, 2])).toThrow(
      new TypeError(
        "Invalid worker node key '-1': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for NaN
    expect(() => checkValidWorkerNodeKeys([NaN])).toThrow(
      new TypeError(
        "Invalid worker node key 'NaN': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for Infinity
    expect(() => checkValidWorkerNodeKeys([Infinity])).toThrow(
      new TypeError(
        "Invalid worker node key 'Infinity': must be a non-negative safe integer"
      )
    )
    expect(() => checkValidWorkerNodeKeys([-Infinity])).toThrow(
      new TypeError(
        "Invalid worker node key '-Infinity': must be a non-negative safe integer"
      )
    )
    // Should throw TypeError for duplicate keys
    expect(() => checkValidWorkerNodeKeys([0, 0, 1])).toThrow(
      new TypeError('Invalid worker node keys: must not contain duplicates')
    )
    expect(() => checkValidWorkerNodeKeys([1, 2, 1])).toThrow(
      new TypeError('Invalid worker node keys: must not contain duplicates')
    )
    // Should not throw with maxPoolSize when keys are in range
    expect(() => checkValidWorkerNodeKeys([0, 1, 2], 4)).not.toThrow()
    // Should throw RangeError when keys exceed maxPoolSize count
    expect(() => checkValidWorkerNodeKeys([0, 1, 2, 3, 4], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with more worker node keys than the maximum number of workers in the pool'
      )
    )
    // Should throw RangeError when a key is out of range
    expect(() => checkValidWorkerNodeKeys([0, 4], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with invalid worker node keys: 4. Valid keys are: 0..3'
      )
    )
    expect(() => checkValidWorkerNodeKeys([999], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with invalid worker node keys: 999. Valid keys are: 0..3'
      )
    )
  })
})
