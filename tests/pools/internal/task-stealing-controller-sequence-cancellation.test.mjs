import { describe, expect, it, vi } from 'vitest'

import { TaskStealingController } from '../../../lib/pools/task-stealing-controller.mjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.mjs'

const createWorker = queueSize => ({
  info: {
    backPressure: true,
    backPressureStealing: false,
    continuousStealing: false,
    dynamic: false,
    queuedTaskAbortion: false,
    ready: true,
    stealing: false,
    stolen: false,
  },
  tasksQueueSize: () => queueSize,
})

const createFixture = task => {
  const source = {
    lease: { generation: 1, id: 1 },
    worker: createWorker(2),
  }
  const destination = {
    lease: { generation: 1, id: 2 },
    worker: createWorker(0),
  }
  const untracked = {
    lease: { generation: 1, id: 3 },
    worker: createWorker(0),
  }
  const handles = [source, destination, untracked]
  const timers = []
  const scheduler = {
    steal: vi.fn(() => ({
      handle: destination,
      kind: 'committed',
      state: 'queued',
      taskId: task.taskId,
    })),
  }
  const callbacks = {
    applyResult: vi.fn(),
    cancel: vi.fn(),
    canSteal: () => true,
    defer: callback => callback(),
    handles: () => handles,
    isIdle: vi.fn(() => true),
    onError: vi.fn(),
    onStolen: vi.fn(),
    ratio: () => 1,
    resetSequence: vi.fn(),
    schedule: vi.fn((callback, delay) => {
      const timer = { callback, delay }
      timers.push(timer)
      return timer
    }),
    sequentiallyStolen: vi.fn(() => 0),
    updateSequence: vi.fn(),
  }
  const coordinator = {
    handle: candidate => handles.find(handle => handle.worker === candidate),
    isCurrent: handle => handles.includes(handle),
    isSchedulable: () => true,
  }
  return {
    callbacks,
    controller: new TaskStealingController(
      scheduler,
      { get: () => ({ task }) },
      coordinator,
      callbacks
    ),
    destination,
    handles,
    scheduler,
    source,
    timers,
    untracked,
  }
}

const operationFlags = handle => ({
  backPressureStealing: handle.worker.info.backPressureStealing,
  stealing: handle.worker.info.stealing,
  stolen: handle.worker.info.stolen,
})

const markOperationsActive = handle => {
  handle.worker.info.backPressureStealing = true
  handle.worker.info.stealing = true
  handle.worker.info.stolen = true
}

describe('TaskStealingController sequence identity and cancellation', () => {
  it('passes an unnamed task to onStolen but only its normalized name to sequence callbacks', () => {
    const payload = {
      marker: 'must-not-reach-sequence-callbacks',
      values: Array.from({ length: 512 }, (_, index) => index),
    }
    const task = { data: payload, taskId: 'unnamed-task' }
    const fixture = createFixture(task)
    let observedSynchronously = false
    let observedTask
    fixture.callbacks.onStolen.mockImplementation((_handle, stolenTask) => {
      observedTask = stolenTask
      observedSynchronously = true
    })

    fixture.controller.idle(fixture.destination)

    expect(observedSynchronously).toBe(true)
    expect(observedTask).toBe(task)
    expect(fixture.callbacks.onStolen).toHaveBeenCalledWith(
      fixture.destination,
      task
    )
    expect(fixture.callbacks.updateSequence).toHaveBeenCalledOnce()
    const sequenceCall = fixture.callbacks.updateSequence.mock.calls[0]
    expect(sequenceCall).toHaveLength(3)
    expect(sequenceCall[0]).toBe(fixture.destination)
    expect(typeof sequenceCall[1]).toBe('string')
    expect(sequenceCall[1]).toBe(DEFAULT_TASK_NAME)
    expect(sequenceCall[2]).toBeUndefined()
    expect(fixture.callbacks.updateSequence.mock.calls.flat()).not.toContain(
      task
    )
    expect(fixture.callbacks.updateSequence.mock.calls.flat()).not.toContain(
      payload
    )
  })

  it('terminates a retained named sequence when one destination is cancelled', () => {
    const fixture = createFixture({
      name: DEFAULT_TASK_NAME,
      taskId: 'named-task-id',
    })
    fixture.callbacks.sequentiallyStolen.mockReturnValue(2)
    fixture.controller.idle(fixture.destination)
    const timer = fixture.timers[0]
    markOperationsActive(fixture.destination)
    const expectedFlags = operationFlags(fixture.destination)

    fixture.controller.cancel(fixture.destination)

    expect(fixture.destination.worker.info.continuousStealing).toBe(false)
    expect(fixture.callbacks.cancel).toHaveBeenCalledWith(timer)
    expect(fixture.callbacks.resetSequence).toHaveBeenCalledWith(
      fixture.destination,
      DEFAULT_TASK_NAME
    )
    expect(operationFlags(fixture.destination)).toEqual(expectedFlags)
    timer.callback()
    expect(fixture.scheduler.steal).toHaveBeenCalledOnce()
    expect(fixture.callbacks.schedule).toHaveBeenCalledOnce()
  })

  it('terminates continuous stealing without retained state or a sequence', () => {
    const fixture = createFixture({
      name: 'named-task',
      taskId: 'named-task-id',
    })
    fixture.destination.worker.info.continuousStealing = true
    markOperationsActive(fixture.destination)
    const expectedFlags = operationFlags(fixture.destination)

    fixture.controller.cancel(fixture.destination)

    expect(fixture.destination.worker.info.continuousStealing).toBe(false)
    expect(fixture.callbacks.cancel).not.toHaveBeenCalled()
    expect(fixture.callbacks.resetSequence).not.toHaveBeenCalled()
    expect(operationFlags(fixture.destination)).toEqual(expectedFlags)
  })

  it('terminates a retained default sequence when its recursive steal throws', () => {
    const fixture = createFixture({ taskId: 'unnamed-task-id' })
    const error = new Error('recursive steal failure')
    fixture.callbacks.sequentiallyStolen.mockReturnValue(1)

    fixture.controller.idle(fixture.destination)
    const timer = fixture.timers[0]
    fixture.scheduler.steal.mockImplementationOnce(() => {
      throw error
    })

    expect(fixture.callbacks.updateSequence).toHaveBeenCalledWith(
      fixture.destination,
      DEFAULT_TASK_NAME,
      undefined
    )
    expect(fixture.timers).toHaveLength(1)
    expect(() => timer.callback()).not.toThrow()
    expect(fixture.callbacks.onError).toHaveBeenCalledOnce()
    expect(fixture.callbacks.onError).toHaveBeenCalledWith(error)
    expect(fixture.destination.worker.info.continuousStealing).toBe(false)
    expect(fixture.callbacks.resetSequence).toHaveBeenCalledWith(
      fixture.destination,
      DEFAULT_TASK_NAME
    )
    expect(fixture.callbacks.schedule).toHaveBeenCalledOnce()
    expect(operationFlags(fixture.destination)).toEqual({
      backPressureStealing: false,
      stealing: false,
      stolen: false,
    })

    expect(() => timer.callback()).not.toThrow()
    expect(fixture.scheduler.steal).toHaveBeenCalledTimes(2)
    expect(fixture.callbacks.onError).toHaveBeenCalledOnce()
    expect(fixture.callbacks.schedule).toHaveBeenCalledOnce()

    fixture.controller.idle(fixture.destination)

    expect(fixture.scheduler.steal).toHaveBeenCalledTimes(3)
    expect(fixture.callbacks.schedule).toHaveBeenCalledTimes(2)
  })

  it('terminates every current handle when all stealing is cancelled', () => {
    const fixture = createFixture({
      name: 'named-task',
      taskId: 'named-task-id',
    })
    fixture.controller.idle(fixture.destination)
    const timer = fixture.timers[0]
    for (const handle of fixture.handles) {
      handle.worker.info.continuousStealing = true
      markOperationsActive(handle)
    }
    const expectedFlags = fixture.handles.map(operationFlags)

    fixture.controller.cancelAll()

    expect(
      fixture.handles.map(handle => handle.worker.info.continuousStealing)
    ).toEqual([false, false, false])
    expect(fixture.callbacks.cancel).toHaveBeenCalledWith(timer)
    expect(fixture.handles.map(operationFlags)).toEqual(expectedFlags)
    expect(fixture.untracked.worker.info.continuousStealing).toBe(false)
  })
})
