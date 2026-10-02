import { restore, stub } from 'sinon'
import { afterEach, describe, expect, it } from 'vitest'

import { ThreadWorker } from '../../lib/index.mjs'
import { DEFAULT_TASK_NAME } from '../../lib/utils.mjs'

const task = {
  data: 21,
  name: DEFAULT_TASK_NAME,
  taskId: '550e8400-e29b-41d4-a716-446655440000',
}

const runTask = taskFunction => {
  const worker = new ThreadWorker(taskFunction)
  worker.statistics = { elu: false, runTime: false }
  const response = Promise.withResolvers()
  const sendToMainWorker = stub(worker, 'sendToMainWorker').callsFake(
    response.resolve
  )

  worker.run(task)

  return { response: response.promise, sendToMainWorker }
}

describe('Abstract worker task settlement', () => {
  afterEach(() => {
    restore()
  })

  it('settles a resolved Promise returned by a non-async task once', async () => {
    const taskFunction = stub().returns(Promise.resolve(42))

    const { response, sendToMainWorker } = runTask(taskFunction)

    await expect(response).resolves.toMatchObject({
      data: 42,
      taskId: task.taskId,
    })
    expect(taskFunction.callCount).toBe(1)
    expect(sendToMainWorker.callCount).toBe(1)
  })

  it('settles a rejected Promise returned by a non-async task once', async () => {
    const taskFunction = stub().returns(
      Promise.reject(new Error('rejected Promise'))
    )

    const { response, sendToMainWorker } = runTask(taskFunction)

    await expect(response).resolves.toMatchObject({
      taskId: task.taskId,
      workerError: { error: { message: 'rejected Promise' } },
    })
    expect(taskFunction.callCount).toBe(1)
    expect(sendToMainWorker.callCount).toBe(1)
  })

  it('assimilates a resolving thenable returned by a task', async () => {
    const thenable = { then: resolve => resolve(42) }

    const { response } = runTask(() => thenable)

    await expect(response).resolves.toMatchObject({
      data: 42,
      taskId: task.taskId,
    })
  })

  it('assimilates a rejecting thenable returned by a task', async () => {
    const thenable = {
      then: (_resolve, reject) => reject(new Error('rejected thenable')),
    }

    const { response } = runTask(() => thenable)

    await expect(response).resolves.toMatchObject({
      taskId: task.taskId,
      workerError: { error: { message: 'rejected thenable' } },
    })
  })

  it('sends a synchronous value before run returns', () => {
    const worker = new ThreadWorker(() => 42)
    worker.statistics = { elu: false, runTime: false }
    const sendToMainWorker = stub(worker, 'sendToMainWorker').returns()

    worker.run(task)

    expect(sendToMainWorker.callCount).toBe(1)
    expect(sendToMainWorker.firstCall.args[0]).toMatchObject({
      data: 42,
      taskId: task.taskId,
    })
  })

  it('sends a synchronous throw before run returns', () => {
    const worker = new ThreadWorker(() => {
      throw new Error('synchronous throw')
    })
    worker.statistics = { elu: false, runTime: false }
    const sendToMainWorker = stub(worker, 'sendToMainWorker').returns()

    worker.run(task)

    expect(sendToMainWorker.callCount).toBe(1)
    expect(sendToMainWorker.firstCall.args[0]).toMatchObject({
      taskId: task.taskId,
      workerError: { error: { message: 'synchronous throw' } },
    })
  })
})
