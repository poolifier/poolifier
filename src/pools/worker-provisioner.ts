import type { WorkerHandle } from './lifecycle-types.js'
import type { PoolEventPublisher } from './pool-event-publisher.js'
import type { PoolOptions } from './pool.js'
import type { WorkerLifecycleCoordinator } from './worker-lifecycle-coordinator.js'
import type { IWorker, IWorkerNode } from './worker.js'

import { EMPTY_FUNCTION } from '../utils.js'

export interface ProvisionedWorker<WorkerNode> {
  readonly handle: WorkerHandle<WorkerNode>
  readonly workerNode: WorkerNode
}

export interface WorkerProvisioningCallbacks<WorkerNode> {
  readonly acquire: () => boolean
  readonly create: () => WorkerNode
  readonly onCrash: (handle: WorkerHandle<WorkerNode>, error: Error) => void
  readonly onExit: (
    handle: WorkerHandle<WorkerNode>,
    exitCode: null | number,
    signal?: NodeJS.Signals | null
  ) => void
  readonly rollback: (
    workerNode: WorkerNode,
    handle: undefined | WorkerHandle<WorkerNode>,
    error: unknown
  ) => never
}

export class WorkerProvisioner<Worker extends IWorker, Data> {
  public constructor (
    private readonly coordinator: WorkerLifecycleCoordinator<
      IWorkerNode<Worker, Data>
    >,
    private readonly publisher: PoolEventPublisher,
    private readonly options: PoolOptions<Worker>,
    private readonly callbacks: WorkerProvisioningCallbacks<
      IWorkerNode<Worker, Data>
    >
  ) {}

  public provision (
    dynamic: boolean
  ): ProvisionedWorker<IWorkerNode<Worker, Data>> | undefined {
    if (!this.callbacks.acquire()) return undefined
    const workerNode = this.callbacks.create()
    workerNode.info.dynamic = dynamic
    let handle: undefined | WorkerHandle<IWorkerNode<Worker, Data>>
    try {
      const registeredHandle = this.coordinator.register(workerNode)
      handle = registeredHandle
      this.defineLifecycleInfo(workerNode, registeredHandle)
      this.registerUserHandlers(workerNode, registeredHandle)
      workerNode.prependOnceWorkerEventHandler('error', (error: Error) => {
        this.callbacks.onCrash(registeredHandle, error)
      })
      workerNode.prependOnceWorkerEventHandler(
        'exit',
        (exitCode: null | number, signal?: NodeJS.Signals | null) => {
          this.callbacks.onExit(registeredHandle, exitCode, signal)
        }
      )
      return { handle: registeredHandle, workerNode }
    } catch (error) {
      return this.callbacks.rollback(workerNode, handle, error)
    }
  }

  private defineLifecycleInfo (
    workerNode: IWorkerNode<Worker, Data>,
    handle: WorkerHandle<IWorkerNode<Worker, Data>>
  ): void {
    Object.defineProperties(workerNode.info, {
      crashHandled: {
        enumerable: true,
        get: () => this.coordinator.classification(handle) === 'faulted',
      },
      terminating: {
        enumerable: true,
        get: () => this.coordinator.state(handle) === 'draining',
      },
    })
  }

  private registerUserHandlers (
    workerNode: IWorkerNode<Worker, Data>,
    handle: WorkerHandle<IWorkerNode<Worker, Data>>
  ): void {
    const thisPublisher = this.publisher
    workerNode.registerWorkerEventHandler(
      'online',
      this.options.onlineHandler ?? EMPTY_FUNCTION
    )
    workerNode.registerWorkerEventHandler(
      'message',
      this.options.messageHandler ?? EMPTY_FUNCTION
    )
    const error = this.options.errorHandler ?? EMPTY_FUNCTION
    workerNode.registerWorkerEventHandler(
      'error',
      function (this: Worker, value: Error) {
        thisPublisher.invoke(error, this, [value], handle.lease)
      }
    )
    const exit = this.options.exitHandler ?? EMPTY_FUNCTION
    workerNode.registerWorkerEventHandler(
      'exit',
      function (
        this: Worker,
        code: null | number,
        signal?: NodeJS.Signals | null
      ) {
        thisPublisher.invoke(exit, this, [code, signal], handle.lease)
      }
    )
  }
}
