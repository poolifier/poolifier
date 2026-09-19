import { expect, it, vi } from 'vitest'

import { WorkerProvisioner } from '../../../lib/pools/worker-provisioner.mjs'

it('returns a registered worker without admitting it to pool membership', () => {
  const handlers = []
  const workerNode = {
    info: { dynamic: false },
    prependOnceWorkerEventHandler: (event, listener) => {
      handlers.push(['prepend', event, listener])
    },
    registerWorkerEventHandler: (event, listener) => {
      handlers.push(['register', event, listener])
    },
  }
  const handle = { lease: { generation: 1, id: 7 }, worker: workerNode }
  const coordinator = {
    classification: vi.fn(() => undefined),
    register: vi.fn(() => handle),
    state: vi.fn(() => 'awaitingReady'),
  }
  const provisioner = new WorkerProvisioner(
    coordinator,
    { invoke: vi.fn() },
    {},
    {
      acquire: () => true,
      create: () => workerNode,
      onCrash: vi.fn(),
      onExit: vi.fn(),
      rollback: vi.fn(),
    }
  )

  const provisioned = provisioner.provision(true)

  expect(provisioned).toStrictEqual({ handle, workerNode })
  expect(workerNode.info.dynamic).toBe(true)
  expect(handlers.map(([kind, event]) => [kind, event])).toStrictEqual([
    ['register', 'online'],
    ['register', 'message'],
    ['register', 'error'],
    ['register', 'exit'],
    ['prepend', 'error'],
    ['prepend', 'exit'],
  ])
})

it('rolls back provisioning when worker generation allocation is exhausted', () => {
  const handlers = []
  const workerNode = {
    info: { dynamic: false },
    prependOnceWorkerEventHandler: (event, listener) => {
      handlers.push(['prepend', event, listener])
    },
    registerWorkerEventHandler: (event, listener) => {
      handlers.push(['register', event, listener])
    },
  }
  const exhaustionError = new RangeError('Worker generation counter exhausted')
  const rollbackResult = { rolledBack: true }
  const rollback = vi.fn(() => rollbackResult)
  const provisioner = new WorkerProvisioner(
    {
      classification: vi.fn(() => undefined),
      register: vi.fn(() => {
        throw exhaustionError
      }),
      state: vi.fn(() => 'awaitingReady'),
    },
    { invoke: vi.fn() },
    {},
    {
      acquire: () => true,
      create: () => workerNode,
      onCrash: vi.fn(),
      onExit: vi.fn(),
      rollback,
    }
  )

  const provisioned = provisioner.provision(false)

  expect(provisioned).toBe(rollbackResult)
  expect(rollback).toHaveBeenCalledOnce()
  expect(rollback).toHaveBeenCalledWith(workerNode, undefined, exhaustionError)
  expect(handlers).toStrictEqual([])
})

it('registers the online handler directly with synchronous receiver semantics', () => {
  const handlers = new Map()
  const workerNode = {
    info: { dynamic: false },
    prependOnceWorkerEventHandler: vi.fn(),
    registerWorkerEventHandler: (event, listener) => {
      handlers.set(event, listener)
    },
  }
  const handle = { lease: { generation: 1, id: 7 }, worker: workerNode }
  const publisher = { invoke: vi.fn() }
  const receiver = {}
  const sentinel = new Error('online sentinel')
  const observedReceivers = []
  const onlineHandler = function () {
    observedReceivers.push(this)
    throw sentinel
  }
  const provisioner = new WorkerProvisioner(
    {
      classification: vi.fn(() => undefined),
      register: vi.fn(() => handle),
      state: vi.fn(() => 'awaitingReady'),
    },
    publisher,
    { onlineHandler },
    {
      acquire: () => true,
      create: () => workerNode,
      onCrash: vi.fn(),
      onExit: vi.fn(),
      rollback: vi.fn(),
    }
  )

  provisioner.provision(false)
  const registered = handlers.get('online')

  expect.soft(registered).toBe(onlineHandler)
  expect.soft(() => registered.call(receiver)).toThrow(sentinel)
  expect.soft(observedReceivers).toStrictEqual([receiver])
  expect.soft(publisher.invoke).not.toHaveBeenCalled()
})

it('registers the message handler directly with synchronous payload semantics', () => {
  const handlers = new Map()
  const workerNode = {
    info: { dynamic: false },
    prependOnceWorkerEventHandler: vi.fn(),
    registerWorkerEventHandler: (event, listener) => {
      handlers.set(event, listener)
    },
  }
  const handle = { lease: { generation: 1, id: 7 }, worker: workerNode }
  const publisher = { invoke: vi.fn() }
  const receiver = {}
  const payload = { value: 42 }
  const sentinel = new Error('message sentinel')
  const observedPayloads = []
  const observedReceivers = []
  const messageHandler = function (value) {
    observedPayloads.push(value)
    observedReceivers.push(this)
    throw sentinel
  }
  const provisioner = new WorkerProvisioner(
    {
      classification: vi.fn(() => undefined),
      register: vi.fn(() => handle),
      state: vi.fn(() => 'awaitingReady'),
    },
    publisher,
    { messageHandler },
    {
      acquire: () => true,
      create: () => workerNode,
      onCrash: vi.fn(),
      onExit: vi.fn(),
      rollback: vi.fn(),
    }
  )

  provisioner.provision(false)
  const registered = handlers.get('message')

  expect.soft(registered).toBe(messageHandler)
  expect.soft(() => registered.call(receiver, payload)).toThrow(sentinel)
  expect.soft(observedReceivers).toStrictEqual([receiver])
  expect.soft(observedPayloads).toStrictEqual([payload])
  expect.soft(publisher.invoke).not.toHaveBeenCalled()
})

it('projects terminating only while voluntary draining is in progress', () => {
  let state = 'ready'
  const workerNode = {
    info: { dynamic: false },
    prependOnceWorkerEventHandler: vi.fn(),
    registerWorkerEventHandler: vi.fn(),
  }
  const handle = { lease: { generation: 1, id: 7 }, worker: workerNode }
  const provisioner = new WorkerProvisioner(
    {
      classification: vi.fn(() => undefined),
      register: vi.fn(() => handle),
      state: vi.fn(() => state),
    },
    { invoke: vi.fn() },
    {},
    {
      acquire: () => true,
      create: () => workerNode,
      onCrash: vi.fn(),
      onExit: vi.fn(),
      rollback: vi.fn(),
    }
  )
  provisioner.provision(false)

  expect(workerNode.info.terminating).toBe(false)
  state = 'draining'
  expect(workerNode.info.terminating).toBe(true)
  state = 'faulted'
  expect(workerNode.info.terminating).toBe(false)
  state = 'exited'
  expect(workerNode.info.terminating).toBe(false)
  state = 'removed'
  expect(workerNode.info.terminating).toBe(false)
})

it.each(['cluster', 'thread'])(
  'does not begin %s worker provisioning after the pool enters closing',
  async transport => {
    let provisioningPermitted = true
    const create = vi.fn()
    const replacementGate = Promise.withResolvers()
    const provisioner = new WorkerProvisioner(
      {
        classification: vi.fn(),
        register: vi.fn(),
        state: vi.fn(),
      },
      { invoke: vi.fn() },
      {},
      {
        acquire: () => provisioningPermitted,
        create,
        onCrash: vi.fn(),
        onExit: vi.fn(),
        rollback: vi.fn(),
      }
    )

    const heldReplacement = replacementGate.promise.then(() =>
      provisioner.provision(false)
    )
    provisioningPermitted = false
    replacementGate.resolve()
    const provisioned = await heldReplacement

    expect(provisioned).toBeUndefined()
    expect(create).not.toHaveBeenCalled()
    expect(transport).toMatch(/^(cluster|thread)$/)
  }
)
