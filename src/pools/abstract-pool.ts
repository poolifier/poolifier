import type { EventEmitterAsyncResource } from 'node:events'
import type { Transferable } from 'node:worker_threads'

import { AsyncResource } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import type {
  MessageValue,
  Task,
  TaskFunctionProperties,
  TaskUUID,
  WorkerError,
} from '../utility-types.js'
import type {
  TaskFunction,
  TaskFunctionObject,
} from '../worker/task-functions.js'
import type {
  SettlementResult,
  TaskSettlement,
  WorkerHandle,
  WorkerLease,
  WorkerReconciliationInput,
  WorkerReconciliationResult,
} from './lifecycle-types.js'

import { defaultBucketSize } from '../queues/queue-types.js'
import {
  buildTaskFunctionProperties,
  DEFAULT_TASK_NAME,
  isKillBehavior,
  min,
  sleep,
} from '../utils.js'
import { KillBehaviors } from '../worker/worker-options.js'
import {
  PoolUnrecoverableError,
  type WorkerCrashError,
  WorkerTerminationError,
} from './errors.js'
import { PoolEventPublisher } from './pool-event-publisher.js'
import { PoolHealthMonitor } from './pool-health-monitor.js'
import { collectLifecycleFailures, PoolLifecycle } from './pool-lifecycle.js'
import {
  buildPoolOptions,
  checkValidWorkerChoiceStrategyOptions,
  mergeTasksQueueOptions,
} from './pool-options-builder.js'
import { projectPoolInfo, projectPoolStatistics } from './pool-projections.js'
import { PoolTaskEventState } from './pool-task-event-state.js'
import {
  type IPool,
  type PoolEvent,
  PoolEvents,
  type PoolInfo,
  type PoolOptions,
  type PoolType,
  PoolTypes,
  type TasksQueueOptions,
} from './pool.js'
import { ScheduleResultAdapter } from './schedule-result-adapter.js'
import {
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies/selection-strategies-types.js'
import { WorkerChoiceStrategiesContext } from './selection-strategies/worker-choice-strategies-context.js'
import { TaskFunctionBroadcaster } from './task-function-broadcaster.js'
import { TaskFunctionCommitProjector } from './task-function-commit-projector.js'
import { TaskFunctionStaticSchema } from './task-function-static-schema.js'
import { TaskFunctionStore } from './task-function-store.js'
import { TaskFunctionTransactionManager } from './task-function-transaction-manager.js'
import { TaskRegistry } from './task-registry.js'
import { TaskRouter } from './task-routing.js'
import { TaskScheduler } from './task-scheduler.js'
import { TaskStealingController } from './task-stealing-controller.js'
import { TaskUsageAccounting } from './task-usage-accounting.js'
import {
  checkFilePath,
  checkValidPriority,
  checkValidTasksQueueOptions,
  checkValidWorkerChoiceStrategy,
  checkValidWorkerNodeKeys,
  getDefaultTasksQueueOptions,
  hasMultipleTaskFunctions,
  updateEluWorkerUsage,
  updateRunTimeWorkerUsage,
  updateWaitTimeWorkerUsage,
  waitWorkerNodeEvents,
} from './utils.js'
import { version } from './version.js'
import { WorkerAdmission } from './worker-admission.js'
import { WorkerLifecycleCoordinator } from './worker-lifecycle-coordinator.js'
import { WorkerNode } from './worker-node.js'
import { WorkerProvisioner } from './worker-provisioner.js'
import { WorkerReconciliationPolicy } from './worker-reconciliation-policy.js'
import { WorkerRestartCircuitBreaker } from './worker-restart-circuit-breaker.js'
import { WorkerTerminalController } from './worker-terminal-controller.js'
import {
  type IWorker,
  type IWorkerNode,
  type WorkerInfo,
  type WorkerNodeEventDetail,
  type WorkerType,
} from './worker.js'

export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown
> implements IPool<Worker, Data, Response> {
  public readonly workerNodes: IWorkerNode<Worker, Data>[] = []

  public get emitter (): EventEmitterAsyncResource | undefined {
    return this.eventPublisher.emitter
  }

  public get info (): PoolInfo {
    const statistics = projectPoolStatistics(
      this.workerNodes.map(workerNode => workerNode.usage),
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
    )
    return projectPoolInfo({
      backPressure: this.backPressure,
      defaultStrategy:
        this.opts.workerChoiceStrategy ?? WorkerChoiceStrategies.LEAST_USED,
      enableTasksQueue: this.opts.enableTasksQueue === true,
      maxSize: this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
      minSize: this.minimumNumberOfWorkers,
      queuedTasks: this.getQueuedTasks(),
      ready: this.ready,
      started: this.started,
      statistics,
      strategyRetries:
        this.workerChoiceStrategiesContext?.getStrategyRetries() ?? 0,
      type: this.type,
      utilization: this.utilization,
      version,
      worker: this.worker,
      workers: this.workerNodes.map((workerNode, workerNodeKey) => ({
        backPressured: this.isWorkerNodeBackPressured(workerNodeKey),
        busy: this.isWorkerNodeBusy(workerNodeKey),
        dynamic: workerNode.info.dynamic,
        idle: this.isWorkerNodeIdle(workerNodeKey),
        maxQueued: workerNode.usage.tasks.maxQueued ?? 0,
        stealing: this.isWorkerNodeStealing(workerNodeKey),
        tasks: workerNode.usage.tasks,
      })),
    })
  }

  protected readonly opts: PoolOptions<Worker>

  protected readonly taskFunctionTransactionTimeout = 30_000

  protected readonly taskRegistry = new TaskRegistry<Data, Response>()

  protected workerChoiceStrategiesContext?: WorkerChoiceStrategiesContext<
    Worker,
    Data,
    Response
  >

  private readonly workerReconciliationPolicy: WorkerReconciliationPolicy<
    Worker,
    Data
  >

  protected readonly workerLifecycleCoordinator =
    new WorkerLifecycleCoordinator<IWorkerNode<Worker, Data>>({
      complete: (input, signal) =>
        this.workerReconciliationPolicy.complete(input, signal),
      drain: (handle, signal) => {
        signal.throwIfAborted()
        if (this.destroying) {
          this.transferWorkerListenerErrors(handle.lease)
        } else {
          this.drainWorkerListenerErrors(handle.lease)
        }
        return Promise.resolve()
      },
      exclude: () => undefined,
      isPoolRunning: () => this.started && !this.destroying,
      reconcile: (input, signal) =>
        this.workerReconciliationPolicy.reconcile(input, signal),
      remove: handle => {
        this.removeWorkerNode(handle.worker)
      },
      replace: (input, signal) =>
        this.workerReconciliationPolicy.replace(input, signal),
      shouldReplace: input =>
        this.workerReconciliationPolicy.shouldReplace(input),
      snapshotOwnedWork: lease => this.taskRegistry.snapshotByLease(lease),
      terminate: (input, signal) => this.terminateWorkerNode(input, signal),
    })

  protected abstract get backPressure (): boolean

  protected abstract get busy (): boolean

  protected get destroying (): boolean {
    return this.poolLifecycle.destroying
  }

  protected get started (): boolean {
    return this.poolLifecycle.running
  }

  protected get starting (): boolean {
    return this.poolLifecycle.starting
  }

  protected abstract get type (): PoolType

  protected abstract get worker (): WorkerType

  private readonly eventPublisher: PoolEventPublisher
  private readonly poolHealthMonitor: PoolHealthMonitor
  private readonly poolLifecycle = new PoolLifecycle()

  private readonly publishedWorkerReconciliations = new WeakSet<
    Promise<WorkerReconciliationResult>
  >()

  private readonly scheduleResultAdapter: ScheduleResultAdapter<
    IWorkerNode<Worker, Data>,
    Data
  >

  private startTimestamp?: number

  private readonly taskEventState: PoolTaskEventState<PoolInfo>

  private readonly taskFunctionBroadcaster: TaskFunctionBroadcaster<
    IWorkerNode<Worker, Data>,
    Data,
    Response
  >

  private readonly taskFunctionCommitProjector: TaskFunctionCommitProjector<
    Data,
    Response
  >

  private readonly taskFunctionStaticSchema = new TaskFunctionStaticSchema()

  private readonly taskFunctionStore: TaskFunctionStore<Data, Response>

  private readonly taskFunctionTransactionManager: TaskFunctionTransactionManager<
    IWorkerNode<Worker, Data>,
    Data,
    Response
  >

  private readonly taskRouter: TaskRouter<
    IWorkerNode<Worker, Data>,
    Data,
    Response
  >

  private readonly taskScheduler: TaskScheduler<
    IWorkerNode<Worker, Data>,
    Data,
    Response
  >

  private readonly taskStealingController: TaskStealingController<
    IWorkerNode<Worker, Data>,
    Data,
    Response
  >

  private readonly taskUsageAccounting: TaskUsageAccounting<
    IWorkerNode<Worker, Data>,
    Data,
    Response
  >

  private readonly workerAdmission: WorkerAdmission<
    IWorkerNode<Worker, Data>,
    Data,
    Response,
    WorkerChoiceStrategy
  >

  private readonly workerProvisioner: WorkerProvisioner<Worker, Data>

  private readonly workerRestartCircuitBreaker: WorkerRestartCircuitBreaker

  private readonly workerTerminalController = new WorkerTerminalController(
    this.workerLifecycleCoordinator,
    {
      isAbnormalExit: (exitCode, signal, workerId) =>
        this.isAbnormalExit(exitCode, signal, workerId),
      rejectOwnedTasks: (handle, error) => this.rejectOwnedTasks(handle, error),
      rejectTaskFunctionRequests: (handle, error) => {
        this.taskFunctionBroadcaster.reject(handle, error)
      },
      track: (lease, reconciliation) => {
        this.trackWorkerReconciliation(lease, reconciliation)
      },
    }
  )

  private get ready (): boolean {
    return (
      this.started && this.readyWorkerNodeCount() >= this.minimumNumberOfWorkers
    )
  }

  private get utilization (): number {
    if (this.startTimestamp == null) {
      return 0
    }
    const poolTimeCapacity =
      (performance.now() - this.startTimestamp) *
      (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    if (!Number.isFinite(poolTimeCapacity) || poolTimeCapacity <= 0) {
      return 0
    }
    const totalTasksRunTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.runTime.aggregate ?? 0),
      0
    )
    const totalTasksWaitTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.waitTime.aggregate ?? 0),
      0
    )
    return (totalTasksRunTime + totalTasksWaitTime) / poolTimeCapacity
  }

  public constructor (
    protected readonly minimumNumberOfWorkers: number,
    protected readonly filePath: string,
    opts: PoolOptions<Worker>,
    protected readonly maximumNumberOfWorkers?: number
  ) {
    if (!this.isMain()) {
      throw new Error(
        'Cannot start a pool from a worker with the same type as the pool'
      )
    }
    this.checkPoolType()
    checkFilePath(this.filePath)
    this.checkMinimumNumberOfWorkers(this.minimumNumberOfWorkers)
    this.opts = buildPoolOptions(
      opts,
      this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
    )
    this.workerRestartCircuitBreaker = new WorkerRestartCircuitBreaker(
      this.opts.restartPolicy?.maxRestarts,
      this.opts.restartPolicy?.windowTime
    )
    this.poolHealthMonitor = new PoolHealthMonitor({
      minSize: () => this.minimumNumberOfWorkers,
      publishDegraded: event => {
        this.publishPoolEvent(PoolEvents.degraded, event)
      },
      publishDegradedEnd: () => {
        this.publishPoolEvent(PoolEvents.degradedEnd, this.info)
      },
      readyWorkerNodeCount: () => this.readyWorkerNodeCount(),
      started: () => this.started,
      tripped: () => this.workerRestartCircuitBreaker.tripped,
    })
    this.workerLifecycleCoordinator.subscribeTopologyChanges(() => {
      this.poolHealthMonitor.refresh()
    })

    this.eventPublisher = new PoolEventPublisher(
      'poolifier:pool',
      this.opts.enableEvents === true
    )
    this.taskEventState = new PoolTaskEventState({
      backPressure: () => this.backPressure,
      busy: () => this.busy,
      info: () => this.info,
      publisher: this.eventPublisher,
      ready: () => this.ready,
    })
    this.taskScheduler = new TaskScheduler(this.taskRegistry, {
      acquire: handle =>
        this.workerLifecycleCoordinator.acquireDispatch(handle),
      candidates: source => {
        const handles = this.workerLifecycleCoordinator
          .snapshotHandles()
          .filter(
            handle =>
              source == null ||
              (handle !== source &&
                this.workerLifecycleCoordinator.isSchedulable(handle))
          )
        return source == null
          ? handles
          : handles.sort(
            (left, right) =>
              left.worker.usage.tasks.queued - right.worker.usage.tasks.queued
          )
      },
      send: (permit, task, transferList) => {
        const workerNodeKey = this.getWorkerNodeKeyByHandle(permit.handle)
        if (workerNodeKey === -1) {
          throw new Error('Dispatch worker is no longer available')
        }
        this.sendToWorker(workerNodeKey, task, transferList)
      },
      sendAbort: (handle, taskId) => {
        const workerNodeKey = this.getWorkerNodeKeyByHandle(handle)
        if (workerNodeKey !== -1) {
          this.sendToWorker(workerNodeKey, { taskId, taskOperation: 'abort' })
        }
      },
      shouldDispatch: permit => {
        const workerNodeKey = this.getWorkerNodeKeyByHandle(permit.handle)
        return (
          permit.readiness === 'ready' &&
          workerNodeKey !== -1 &&
          !this.isWorkerNodeBusy(workerNodeKey)
        )
      },
    })
    this.taskFunctionBroadcaster = new TaskFunctionBroadcaster({
      admit: handle =>
        this.workerLifecycleCoordinator.acquireDispatch(handle) != null,
      deregister: (handle, listener) => {
        const key = this.getWorkerNodeKeyByHandle(handle)
        if (key !== -1) this.deregisterWorkerMessageListener(key, listener)
      },
      isCurrent: handle => this.workerLifecycleCoordinator.isCurrent(handle),
      register: (handle, listener) => {
        const key = this.getWorkerNodeKeyByHandle(handle)
        if (key !== -1) this.registerWorkerMessageListener(key, listener)
      },
      send: (handle, message) => {
        const key = this.getWorkerNodeKeyByHandle(handle)
        if (key !== -1) this.sendToWorker(key, message)
      },
      snapshot: () => this.workerLifecycleCoordinator.snapshotHandles(),
    })
    this.taskFunctionCommitProjector = new TaskFunctionCommitProjector({
      defer: error => {
        this.eventPublisher.defer(error)
      },
      projectRemovedUsage: (name, workerNodeKey) => {
        this.workerNodes[workerNodeKey]?.deleteTaskFunctionWorkerUsage(name)
      },
      report: (error, snapshot) => {
        this.publishPoolError(error)
      },
      sendStatistics: workerNodeKey => {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      },
      synchronizeStrategies: () => {
        this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
          this.getWorkerChoiceStrategies()
        )
      },
      workerNodeKeys: () => this.workerNodes.keys(),
    })
    this.taskFunctionTransactionManager = new TaskFunctionTransactionManager({
      defer: error => {
        this.eventPublisher.defer(error)
      },
      exclude: (handle, cause) => {
        this.taskFunctionBroadcaster.reject(
          handle,
          cause instanceof Error ? cause : new Error(String(cause))
        )
        return this.workerLifecycleCoordinator.quarantine(handle, cause)
      },
      hasStaticTaskFunction: name => this.taskFunctionStaticSchema.has(name),
      onCommit: (snapshot, previous) => {
        this.taskFunctionCommitProjector.project(snapshot, previous)
      },
      onPostCommitError: error => {
        this.publishPoolError(error)
      },
      reconcile: handle => {
        this.trackWorkerReconciliation(
          handle.lease,
          this.workerLifecycleCoordinator.reconcile(handle)
        )
      },
      send: async (handle, request, signal) =>
        await this.taskFunctionBroadcaster.sendToWorker(
          handle,
          {
            ...(request.taskFunction != null && {
              taskFunction: request.taskFunction.taskFunction.toString(),
            }),
            taskFunctionOperation: request.operation,
            taskFunctionOperationId: request.operationId,
            taskFunctionProperties: buildTaskFunctionProperties(
              request.name,
              request.taskFunction
            ),
          },
          signal
        ),
      snapshotReadyHandles: () =>
        this.workerLifecycleCoordinator.snapshotReadyHandles(),
      subscribeTopologyChanges: listener =>
        this.workerLifecycleCoordinator.subscribeTopologyChanges(listener),
      timeout: () => this.taskFunctionTransactionTimeout,
      topologyEpoch: () => this.workerLifecycleCoordinator.topologyEpoch,
    })
    this.taskFunctionStore = new TaskFunctionStore(
      () => this.taskFunctionTransactionManager.snapshot
    )
    this.workerProvisioner = new WorkerProvisioner(
      this.workerLifecycleCoordinator,
      this.eventPublisher,
      this.opts,
      {
        acquire: () => this.poolLifecycle.acquireProvisioningPermit(),
        create: () => this.createWorkerNode(),
        onCrash: (handle, error) => {
          this.startWorkerNodeCrashHandling(handle, error)
        },
        onExit: (handle, exitCode, signal) => {
          this.startWorkerNodeExitHandling(handle, exitCode, signal)
        },
        rollback: (workerNode, handle, error) =>
          this.rollbackWorkerNodeSetup(workerNode, handle, error),
      }
    )
    this.workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext<
      Worker,
      Data,
      Response
    >(
      this,
      [this.opts.workerChoiceStrategy ?? WorkerChoiceStrategies.LEAST_USED],
      this.opts.workerChoiceStrategyOptions
    )
    this.taskUsageAccounting = new TaskUsageAccounting({
      getWorkerNodeKeyByLease: lease => this.getWorkerNodeKeyByLease(lease),
      shouldUpdateTaskFunctionUsage: workerNodeKey =>
        this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey),
      updateElu: (usage, message) => {
        updateEluWorkerUsage(this.workerChoiceStrategiesContext, usage, message)
      },
      updateRunTime: (usage, message) => {
        updateRunTimeWorkerUsage(
          this.workerChoiceStrategiesContext,
          usage,
          message
        )
      },
      updateStrategy: workerNodeKey =>
        this.workerChoiceStrategiesContext?.update(workerNodeKey),
      updateWaitTime: (usage, task) => {
        updateWaitTimeWorkerUsage(
          this.workerChoiceStrategiesContext,
          usage,
          task
        )
      },
      workerNodes: () => this.workerNodes,
    })
    this.scheduleResultAdapter = new ScheduleResultAdapter({
      accounting: this.taskUsageAccounting,
      beforeTaskExecution: (workerNodeKey, task) => {
        this.beforeTaskExecutionHook(workerNodeKey, task)
      },
      events: this.taskEventState,
      getTask: taskId => this.taskRegistry.get(taskId)?.task,
      getWorkerNodeKeyByHandle: handle => this.getWorkerNodeKeyByHandle(handle),
      publisher: this.eventPublisher,
    })
    const tasksFinishedTimeout = (): number =>
      this.opts.tasksQueueOptions?.tasksFinishedTimeout ??
      getDefaultTasksQueueOptions(
        this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
      ).tasksFinishedTimeout
    this.workerReconciliationPolicy = new WorkerReconciliationPolicy({
      apply: (result, owner) => {
        this.scheduleResultAdapter.apply(result, owner)
      },
      attemptRestart: () => this.workerRestartCircuitBreaker.attemptRestart(),
      createDynamic: () => {
        this.createAndSetupDynamicWorkerNode()
      },
      defer: (error, owner) => {
        this.eventPublisher.defer(error, owner)
      },
      detachQueued: handle => {
        this.taskScheduler.detachQueued(handle)
      },
      drainPhysical: handle => {
        this.taskScheduler.drainPhysical(handle)
      },
      executionFinished: owner => {
        this.taskEventState.checkExecutionFinished(owner)
      },
      isRunning: () => this.started,
      publishError: (error, owner) => {
        this.publishPoolError(error, owner)
      },
      reject: (taskId, worker, error, owner) =>
        this.rejectTaskPromise(taskId, worker, error, owner),
      replenishFixed: () => {
        this.startMinimumNumberOfWorkers(true)
      },
      reserve: (taskIds, owner) =>
        this.taskScheduler.reserveForReconciliation(taskIds, owner),
      restartWorkerOnError: () => this.opts.restartWorkerOnError === true,
      restore: (taskIds, error) =>
        this.taskScheduler.restore(
          taskIds,
          this.workerLifecycleCoordinator
            .snapshotHandles()
            .filter(
              handle =>
                this.workerLifecycleCoordinator.acquireDispatch(handle) != null
            ),
          error
        ),
      rollbackStartup: failed => {
        this.poolLifecycle.stop()
        for (const sibling of this.workerLifecycleCoordinator.snapshotHandles()) {
          if (sibling.worker === failed) continue
          this.trackWorkerReconciliation(
            sibling.lease,
            this.workerLifecycleCoordinator.beginDrain(
              sibling,
              new WorkerTerminationError(
                'Worker node terminated after partial startup failure',
                { workerId: sibling.lease.id }
              )
            )
          )
        }
      },
      taskDequeued: owner => {
        this.taskEventState.checkTaskDequeued(owner)
      },
      tasksFinishedTimeout,
      waitForDrain: async (worker, signal) => {
        await waitWorkerNodeEvents(
          worker,
          'taskExecutionFinished',
          worker.usage.tasks.executing,
          tasksFinishedTimeout(),
          false,
          signal
        )
      },
      workers: () => this.workerNodes,
    })
    this.taskRouter = new TaskRouter(this.taskScheduler, {
      concurrency: () => this.opts.tasksQueueOptions?.concurrency ?? 1,
      executing: workerNode => workerNode.usage.tasks.executing,
      onResult: result => {
        this.scheduleResultAdapter.apply(result)
      },
      queuesEnabled: () => this.opts.enableTasksQueue === true,
    })
    this.taskStealingController = new TaskStealingController(
      this.taskScheduler,
      this.taskRegistry,
      this.workerLifecycleCoordinator,
      {
        applyResult: result => {
          this.scheduleResultAdapter.apply(result)
        },
        cancel: timer => {
          timer.cancel()
        },
        canSteal: () => !this.cannotStealTask(),
        defer: callback => {
          queueMicrotask(callback)
        },
        handles: () => this.workerLifecycleCoordinator.snapshotHandles(),
        isIdle: handle => {
          const key = this.getWorkerNodeKeyByHandle(handle)
          return key !== -1 && this.isWorkerNodeIdle(key)
        },
        onError: error => {
          this.publishPoolError(error)
        },
        onStolen: (handle, task) => {
          const key = this.getWorkerNodeKeyByHandle(handle)
          if (key !== -1) {
            this.updateTaskStolenStatisticsWorkerUsage(
              key,
              task.name ?? DEFAULT_TASK_NAME
            )
          }
        },
        ratio: () => this.opts.tasksQueueOptions?.tasksStealingRatio ?? 1,
        resetSequence: (handle, previousTaskName) => {
          const key = this.getWorkerNodeKeyByHandle(handle)
          if (key !== -1) {
            this.taskUsageAccounting.resetSequentiallyStolen(
              key,
              previousTaskName
            )
          }
        },
        schedule: (callback, delay) => {
          const controller = new AbortController()
          const run = async (): Promise<void> => {
            try {
              await sleep(delay, controller.signal)
              if (!controller.signal.aborted) callback()
            } catch (error) {
              if (!controller.signal.aborted) this.publishPoolError(error)
            }
          }
          run().catch((error: unknown) => {
            this.publishPoolError(error)
          })
          return {
            cancel: () => {
              controller.abort()
            },
          }
        },
        sequentiallyStolen: handle =>
          handle.worker.usage.tasks.sequentiallyStolen,
        updateSequence: (handle, currentTaskName, previousTaskName) => {
          const key = this.getWorkerNodeKeyByHandle(handle)
          if (key !== -1) {
            this.updateTaskSequentiallyStolenStatisticsWorkerUsage(
              key,
              currentTaskName,
              previousTaskName
            )
          }
        },
      }
    )
    this.workerAdmission = new WorkerAdmission(
      this.workerLifecycleCoordinator,
      this.taskRegistry,
      {
        affinity: name => this.getTaskFunctionWorkerNodeKeysSet(name),
        createWorker: () => {
          this.createAndSetupDynamicWorkerNode()
        },
        isPoolActive: () => this.started,
        maxWorkers: this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
        select: (strategy, candidates) =>
          this.workerChoiceStrategiesContext?.execute(strategy, candidates),
        shouldCreateWorker: () => this.shallCreateDynamicWorker(),
        strategy: name => this.getTaskFunctionWorkerChoiceStrategy(name),
        workerCount: () => this.workerNodes.length,
        workerNodeKey: handle => this.getWorkerNodeKeyByHandle(handle),
      }
    )

    this.setupHook()

    if (this.opts.startWorkers === true) {
      this.start()
    }
  }

  public async addTaskFunction (
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>
  ): Promise<boolean> {
    if (typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (typeof fn === 'function') {
      fn = { taskFunction: fn } satisfies TaskFunctionObject<Data, Response>
    }
    if (typeof fn.taskFunction !== 'function') {
      throw new TypeError('taskFunction property must be a function')
    }
    checkValidPriority(fn.priority)
    checkValidWorkerChoiceStrategy(fn.strategy)
    checkValidWorkerNodeKeys(
      fn.workerNodeKeys,
      this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
    )
    return await this.taskFunctionTransactionManager.add(name, fn)
  }

  public destroy (): Promise<void> {
    return this.poolLifecycle.destroy(() => this.doDestroy())
  }

  public enableTasksQueue (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions
  ): void {
    if (this.opts.enableTasksQueue === true && !enable) {
      this.unsetTaskStealing()
      this.unsetTasksStealingOnBackPressure()
      this.flushTasksQueues()
    }
    this.opts.enableTasksQueue = enable
    this.setTasksQueueOptions(tasksQueueOptions)
  }

  public async execute (
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: readonly Transferable[]
  ): Promise<Response> {
    this.poolLifecycle.requireRunning(
      this.destroying
        ? 'Cannot execute a task on destroying pool'
        : 'Cannot execute a task on not started pool'
    )
    if (name != null && typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (name != null && typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (abortSignal != null && !(abortSignal instanceof AbortSignal)) {
      throw new TypeError('abortSignal argument must be an AbortSignal')
    }
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    return await this.internalExecute(data, name, abortSignal, transferList)
  }

  public hasTaskFunction (name: string): boolean {
    return this.taskFunctionStore.has(
      name,
      this.workerNodesTaskFunctionsProperties()
    )
  }

  public listTaskFunctionsProperties (): TaskFunctionProperties[] {
    return [
      ...this.taskFunctionStore.listProperties(
        this.workerNodesTaskFunctionsProperties()
      ),
    ]
  }

  public async mapExecute (
    data: Iterable<Data>,
    name?: string,
    abortSignals?: Iterable<AbortSignal>,
    transferList?: readonly Transferable[]
  ): Promise<Response[]> {
    this.poolLifecycle.requireRunning(
      this.destroying
        ? 'Cannot execute task(s) on destroying pool'
        : 'Cannot execute task(s) on not started pool'
    )
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (data == null) {
      throw new TypeError('data argument must be a defined iterable')
    }
    if (typeof data[Symbol.iterator] !== 'function') {
      throw new TypeError('data argument must be an iterable')
    }
    if (name != null && typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (name != null && typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (!Array.isArray(data)) {
      data = [...data]
    }
    if (abortSignals != null) {
      if (typeof abortSignals[Symbol.iterator] !== 'function') {
        throw new TypeError('abortSignals argument must be an iterable')
      }
      for (const abortSignal of abortSignals) {
        if (!(abortSignal instanceof AbortSignal)) {
          throw new TypeError(
            'abortSignals argument must be an iterable of AbortSignal'
          )
        }
      }
      if (!Array.isArray(abortSignals)) {
        abortSignals = [...abortSignals]
      }
      if ((data as Data[]).length !== (abortSignals as AbortSignal[]).length) {
        throw new Error(
          'data and abortSignals arguments must have the same length'
        )
      }
    }
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    const tasks: [Data, AbortSignal | undefined][] = Array.from(
      { length: (data as Data[]).length },
      (_, i) => [
        (data as Data[])[i],
        abortSignals != null ? (abortSignals as AbortSignal[])[i] : undefined,
      ]
    )
    return await Promise.all(
      tasks.map(([data, abortSignal]) =>
        this.internalExecute(data, name, abortSignal, transferList)
      )
    )
  }

  public async removeTaskFunction (name: string): Promise<boolean> {
    if (!this.taskFunctionStore.hasRegistered(name)) {
      throw new Error(
        'Cannot remove a task function not handled on the pool side'
      )
    }
    return await this.taskFunctionTransactionManager.remove(name)
  }

  public async setDefaultTaskFunction (name: string): Promise<boolean> {
    if (typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (name === DEFAULT_TASK_NAME) {
      throw new Error(
        'Cannot set the default task function reserved name as the default task function'
      )
    }
    if (!this.hasTaskFunction(name)) {
      throw new Error(
        'Cannot set the default task function to a non-existing task function'
      )
    }
    return await this.taskFunctionTransactionManager.setDefault(name)
  }

  public setTasksQueueOptions (
    tasksQueueOptions: TasksQueueOptions | undefined
  ): void {
    if (this.opts.enableTasksQueue === true) {
      checkValidTasksQueueOptions(tasksQueueOptions)
      this.opts.tasksQueueOptions = mergeTasksQueueOptions(
        this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
        this.opts.tasksQueueOptions,
        tasksQueueOptions
      )
      this.setTasksQueueSize(
        this.opts.tasksQueueOptions.size ??
          getDefaultTasksQueueOptions(
            this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
          ).size
      )
      if (this.opts.tasksQueueOptions.taskStealing === true) {
        this.unsetTaskStealing()
        this.setTaskStealing()
      } else {
        this.unsetTaskStealing()
      }
      if (this.opts.tasksQueueOptions.tasksStealingOnBackPressure === true) {
        this.unsetTasksStealingOnBackPressure()
        this.setTasksStealingOnBackPressure()
      } else {
        this.unsetTasksStealingOnBackPressure()
      }
    } else if (this.opts.tasksQueueOptions != null) {
      delete this.opts.tasksQueueOptions
    }
  }

  public setWorkerChoiceStrategy (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  ): void {
    let requireSync = false
    checkValidWorkerChoiceStrategy(workerChoiceStrategy)
    if (workerChoiceStrategyOptions != null) {
      requireSync = !this.setWorkerChoiceStrategyOptions(
        workerChoiceStrategyOptions
      )
    }
    if (workerChoiceStrategy !== this.opts.workerChoiceStrategy) {
      this.opts.workerChoiceStrategy = workerChoiceStrategy
      this.workerChoiceStrategiesContext?.setDefaultWorkerChoiceStrategy(
        this.opts.workerChoiceStrategy,
        this.opts.workerChoiceStrategyOptions
      )
      requireSync = true
    }
    if (requireSync) {
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies(),
        this.opts.workerChoiceStrategyOptions
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
    }
  }

  public setWorkerChoiceStrategyOptions (
    workerChoiceStrategyOptions: undefined | WorkerChoiceStrategyOptions
  ): boolean {
    checkValidWorkerChoiceStrategyOptions(
      workerChoiceStrategyOptions,
      this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
    )
    if (workerChoiceStrategyOptions != null) {
      this.opts.workerChoiceStrategyOptions = {
        ...this.opts.workerChoiceStrategyOptions,
        ...workerChoiceStrategyOptions,
      }
      this.workerChoiceStrategiesContext?.setOptions(
        this.opts.workerChoiceStrategyOptions
      )
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies(),
        this.opts.workerChoiceStrategyOptions
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
      return true
    }
    return false
  }

  public start (): void {
    this.poolLifecycle.beginStart()
    this.poolHealthMonitor.reset()
    this.workerRestartCircuitBreaker.reset()
    const initialHandles = new Set(
      this.workerLifecycleCoordinator.snapshotHandles()
    )
    try {
      this.startMinimumNumberOfWorkers()
      this.startTimestamp = performance.now()
      this.poolLifecycle.commitRunning()
      this.taskEventState.checkReady()
    } catch (startError) {
      for (const handle of this.workerLifecycleCoordinator.snapshotHandles()) {
        if (initialHandles.has(handle)) continue
        this.removeWorkerNode(handle.worker)
        this.trackWorkerReconciliation(
          handle.lease,
          this.workerLifecycleCoordinator.beginDrain(
            handle,
            new WorkerTerminationError(
              'Worker node terminated after startup failure',
              { workerId: handle.lease.id }
            )
          )
        )
      }
      delete this.startTimestamp
      this.poolLifecycle.rollbackStart()
      throw startError
    }
  }

  protected afterTaskExecutionHook (
    workerNodeKey: number,
    message: MessageValue<Response>,
    executingWorkerNodeKey = workerNodeKey,
    settledTaskName?: string
  ): void {
    this.taskUsageAccounting.afterExecution(
      workerNodeKey,
      message,
      executingWorkerNodeKey,
      settledTaskName
    )
  }

  protected afterWorkerNodeSetup (
    workerNodeKey: number,
    handle: WorkerHandle<IWorkerNode<Worker, Data>>
  ): void {
    // Listen to worker messages.
    this.registerWorkerMessageListener<Response>(workerNodeKey, message => {
      if (this.workerLifecycleCoordinator.isCurrent(handle)) {
        this.workerMessageListener(handle, message)
      }
    })
    // Send the startup message to worker.
    this.sendStartupMessageToWorker(workerNodeKey)
    // Send the statistics message to worker.
    this.sendStatisticsMessageToWorker(workerNodeKey)
    if (this.opts.enableTasksQueue === true) {
      if (this.opts.tasksQueueOptions?.taskStealing === true) {
        this.workerNodes[workerNodeKey].on(
          'idle',
          this.handleWorkerNodeIdleEvent
        )
      }
      if (this.opts.tasksQueueOptions?.tasksStealingOnBackPressure === true) {
        this.workerNodes[workerNodeKey].on(
          'backPressure',
          this.handleWorkerNodeBackPressureEvent
        )
      }
    }
    this.workerNodes[workerNodeKey].on('abortTask', this.abortTask)
  }

  protected beforeTaskExecutionHook (
    workerNodeKey: number,
    task: Task<Data>
  ): void {
    this.taskUsageAccounting.beforeExecution(workerNodeKey, task)
  }

  protected abstract checkAndEmitDynamicWorkerCreationEvents (): void

  protected abstract checkAndEmitDynamicWorkerDestructionEvents (): void

  protected createAndSetupDynamicWorkerNode (): number | undefined {
    const workerNodeKey = this.createAndSetupWorkerNode(true)
    if (workerNodeKey == null) return undefined
    const workerNode = this.workerNodes[workerNodeKey]
    const handle = this.workerLifecycleCoordinator.handle(workerNode)
    if (handle == null) {
      throw new TypeError('Worker handle must be defined')
    }
    try {
      this.registerWorkerMessageListener(workerNodeKey, message => {
        if (
          this.destroying ||
          !this.workerLifecycleCoordinator.isCurrent(handle)
        ) {
          return
        }
        if (message.workerId !== handle.lease.id) {
          return
        }
        const localWorkerNodeKey = this.getWorkerNodeKeyByHandle(handle)
        if (localWorkerNodeKey === -1) {
          return
        }
        if (!this.workerLifecycleCoordinator.isSchedulable(handle)) {
          return
        }
        // Kill message received from worker
        if (
          isKillBehavior(KillBehaviors.HARD, message.kill) ||
          (!this.taskRegistry.hasOwnedWork(handle.lease) &&
            isKillBehavior(KillBehaviors.SOFT, message.kill) &&
            this.isWorkerNodeIdle(localWorkerNodeKey) &&
            !this.isWorkerNodeStealing(localWorkerNodeKey))
        ) {
          this.destroyWorkerNode(localWorkerNodeKey).catch((error: unknown) => {
            this.publishPoolError(error)
          })
        }
      })
      this.sendToWorker(workerNodeKey, {
        checkActive: true,
      })
      this.initWorkerNodeUsage(workerNode)
      this.checkAndEmitDynamicWorkerCreationEvents()
      return workerNodeKey
    } catch (setupError) {
      return this.rollbackWorkerNodeSetup(workerNode, handle, setupError)
    }
  }

  protected createAndSetupWorkerNode (dynamic = false): number | undefined {
    const provisionedWorker = this.workerProvisioner.provision(dynamic)
    if (provisionedWorker == null) return undefined
    const { handle, workerNode } = provisionedWorker
    const workerNodeKey = this.addWorkerNode(workerNode)
    this.workerLifecycleCoordinator.finishProvisioning(handle)
    this.afterWorkerNodeSetup(workerNodeKey, handle)
    return workerNodeKey
  }

  protected abstract deregisterWorkerMessageListener<
    Message extends Data | Response
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void

  protected async destroyWorkerNode (
    workerNodeKey: number,
    ownsListenerErrorDrain = true
  ): Promise<void> {
    const workerNode = this.workerNodes[workerNodeKey]
    const handle = this.workerLifecycleCoordinator.handle(workerNode)
    if (handle == null) {
      return
    }
    const cause = new WorkerTerminationError('Worker node terminated by pool', {
      workerId: handle.lease.id,
    })
    const result = await this.workerLifecycleCoordinator.beginDrain(
      handle,
      cause
    )
    if (ownsListenerErrorDrain && !this.destroying && result.committed) {
      this.drainWorkerListenerErrors(handle.lease)
    }
  }

  protected flushTasksQueue (workerNodeKey: number): number {
    const workerNode = this.workerNodes[workerNodeKey]
    const handle = this.workerLifecycleCoordinator.handle(workerNode)
    if (handle == null) return 0
    let flushedTasks = 0
    while (workerNode.tasksQueueSize() > 0) {
      const result = this.taskScheduler.dequeueAndDispatch(handle)
      this.taskEventState.checkTaskDequeued()
      this.scheduleResultAdapter.apply(result)
      if (result.kind === 'retry') break
      if (result.kind === 'committed') ++flushedTasks
    }
    return flushedTasks
  }

  protected getWorkerInfo (workerNodeKey: number): undefined | WorkerInfo {
    return this.workerNodes[workerNodeKey]?.info
  }

  protected internalBackPressure (): boolean {
    if (this.workerNodes.length === 0) return false
    return (
      this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBackPressured(workerNodeKey)
            ? accumulator + 1
            : accumulator,
        0
      ) === this.workerNodes.length
    )
  }

  protected internalBusy (): boolean {
    if (this.workerNodes.length === 0) return false
    return (
      this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBusy(workerNodeKey) ? accumulator + 1 : accumulator,
        0
      ) === this.workerNodes.length
    )
  }

  protected isAbnormalExit (
    exitCode: null | number,
    signal: NodeJS.Signals | null | undefined,
    workerId: number | undefined
  ): boolean {
    return (
      (exitCode != null && exitCode !== 0) ||
      (exitCode == null && signal != null) ||
      (exitCode === 0 && this.hasActiveExecutionForWorkerId(workerId))
    )
  }

  protected abstract isMain (): boolean

  protected publishPoolError (
    error: unknown,
    lifecycleLease?: WorkerLease
  ): void {
    if (error == null) {
      return
    }
    this.publishPoolEvent(PoolEvents.error, error, lifecycleLease)
  }

  protected publishPoolEvent (
    eventName: PoolEvent,
    payload: unknown,
    lifecycleLease?: WorkerLease
  ): void {
    this.eventPublisher.publish(eventName, payload, lifecycleLease)
  }

  protected abstract registerOnceWorkerMessageListener<
    Message extends Data | Response
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void

  protected abstract registerWorkerMessageListener<
    Message extends Data | Response
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void
  ): void

  protected abstract sendStartupMessageToWorker (workerNodeKey: number): void

  protected abstract sendToWorker (
    workerNodeKey: number,
    message: MessageValue<Data>,
    transferList?: readonly Transferable[]
  ): void

  protected setupHook (): void {
    /* Intentionally empty */
  }

  protected abstract shallCreateDynamicWorker (): boolean

  protected waitingReadyTasks (): number {
    return this.workerLifecycleCoordinator
      .snapshotHandles()
      .reduce(
        (count, handle) =>
          count + this.taskRegistry.waitingReadyCount(handle.lease),
        0
      )
  }

  protected readonly workerMessageListener = (
    handle: WorkerHandle<IWorkerNode<Worker, Data>>,
    message: MessageValue<Response>
  ): void => {
    const { kill, ready, taskFunctionsProperties, taskId, workerId } = message
    const workerReadyMessage = ready != null && taskFunctionsProperties != null
    // Late worker ready message received
    if (this.destroying && workerReadyMessage) {
      return
    }
    // Kill messages responses are handled in dedicated listeners
    if (kill != null) {
      return
    }
    if (workerId !== handle.lease.id) {
      return
    }
    if (workerReadyMessage) {
      // Worker ready response received from worker
      this.handleWorkerReadyResponse(handle.lease, message).catch(
        (error: unknown) => {
          this.publishPoolError(error)
        }
      )
    } else if (taskFunctionsProperties != null) {
      // Task function properties message received from worker
      const workerNodeKey = this.getWorkerNodeKeyByHandle(handle)
      const workerInfo = this.getWorkerInfo(workerNodeKey)
      if (workerInfo != null) {
        workerInfo.taskFunctionsProperties = taskFunctionsProperties
        this.sendStatisticsMessageToWorker(workerNodeKey)
        this.setTasksQueuePriority(workerNodeKey)
      }
    } else if (taskId != null) {
      // Task execution response received from worker
      this.handleTaskExecutionResponse(handle.lease, message)
    }
  }

  private readonly abortTask = (eventDetail: WorkerNodeEventDetail): void => {
    if (!this.started || eventDetail.taskId == null) {
      return
    }
    const record = this.taskRegistry.get(eventDetail.taskId)
    if (record == null || record.abortSignal?.aborted === false) {
      return
    }
    this.scheduleResultAdapter.apply(
      this.taskScheduler.abort(eventDetail.taskId)
    )
  }

  private addWorkerNode (workerNode: IWorkerNode<Worker, Data>): number {
    this.workerNodes.push(workerNode)
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey === -1) {
      throw new Error('Worker added not found in worker nodes')
    }
    return workerNodeKey
  }

  private applyRejectedTaskSettlement (
    taskId: TaskUUID,
    result: SettlementResult,
    fallbackWorkerNode?: IWorkerNode<Worker, Data>,
    lifecycleLease?: WorkerLease
  ): void {
    const eventWorkerNode = this.taskUsageAccounting.applyRejectedSettlement(
      result,
      fallbackWorkerNode
    )
    if (eventWorkerNode != null) {
      this.eventPublisher.publishInternal(
        eventWorkerNode,
        'taskFinished',
        taskId,
        lifecycleLease
      )
    }
  }

  private applyTaskSettlementErrors (
    result: SettlementResult,
    lifecycleLease?: WorkerLease
  ): void {
    if (result.settled) {
      this.eventPublisher.deferAll(result.secondaryErrors, lifecycleLease)
    }
  }

  private cannotStealTask (): boolean {
    return (
      !this.started ||
      this.destroying ||
      this.workerNodes.length <= 1 ||
      this.getQueuedTasks() === 0
    )
  }

  private checkMinimumNumberOfWorkers (
    minimumNumberOfWorkers: number | undefined
  ): void {
    if (minimumNumberOfWorkers == null) {
      throw new Error(
        'Cannot instantiate a pool without specifying the number of workers'
      )
    }
    if (!Number.isSafeInteger(minimumNumberOfWorkers)) {
      throw new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers'
      )
    }
    if (minimumNumberOfWorkers < 0) {
      throw new RangeError(
        'Cannot instantiate a pool with a negative number of workers'
      )
    }
    if (this.type === PoolTypes.fixed && minimumNumberOfWorkers === 0) {
      throw new RangeError('Cannot instantiate a fixed pool with zero worker')
    }
  }

  private checkPoolType (): void {
    if (this.type === PoolTypes.fixed && this.maximumNumberOfWorkers != null) {
      throw new Error(
        'Cannot instantiate a fixed pool with a maximum number of workers defined at initialization'
      )
    }
  }

  private chooseWorkerNode (name?: string): number {
    const permit = this.workerAdmission.acquire(name)
    return permit == null ? -1 : this.getWorkerNodeKeyByHandle(permit.handle)
  }

  private createWorkerNode (): IWorkerNode<Worker, Data> {
    const workerNode = new WorkerNode<Worker, Data>(
      this.worker,
      this.filePath,
      {
        clusterSettings: this.opts.settings,
        env: this.opts.env,
        tasksQueueAgingFactor: this.opts.tasksQueueOptions?.agingFactor,
        tasksQueueBackPressureSize:
          this.opts.tasksQueueOptions?.size ??
          getDefaultTasksQueueOptions(
            this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
          ).size,
        tasksQueueBucketSize: defaultBucketSize,
        tasksQueueLoadExponent: this.opts.tasksQueueOptions?.loadExponent,
        tasksQueuePriority: this.getTasksQueuePriority(),
        workerOptions: this.opts.workerOptions,
      }
    )
    return workerNode
  }

  private dispatchQueuedTask (workerNodeKey: number): void {
    const workerNode = this.workerNodes[workerNodeKey]
    const handle = this.workerLifecycleCoordinator.handle(workerNode)
    if (handle == null) return
    while (
      !this.isWorkerNodeBusy(workerNodeKey) &&
      workerNode.tasksQueueSize() > 0
    ) {
      const result = this.taskScheduler.dequeueAndDispatch(handle)
      this.taskEventState.checkTaskDequeued()
      this.scheduleResultAdapter.apply(result)
      if (result.kind === 'retry') return
    }
  }

  private async doDestroy (): Promise<void> {
    this.taskStealingController.cancelAll()
    const failures: Error[] = []
    try {
      while (this.workerLifecycleCoordinator.snapshotHandles().length > 0) {
        const handles = this.workerLifecycleCoordinator.snapshotHandles()
        const drains = handles.map(handle => {
          const error = new WorkerTerminationError(
            'Worker node terminated by pool',
            { workerId: handle.lease.id }
          )
          this.taskFunctionBroadcaster.reject(handle, error)
          return this.workerLifecycleCoordinator.beginDrain(handle, error)
        })
        for (const drain of drains) {
          this.poolLifecycle.track(drain)
        }
        const outcomes = await this.poolLifecycle.drain()
        failures.push(...collectLifecycleFailures(outcomes))
      }
    } finally {
      try {
        delete this.startTimestamp
        if (this.emitter != null) {
          try {
            this.publishPoolEvent(PoolEvents.destroy, this.info)
          } finally {
            this.taskEventState.readyEventEmitted = false
          }
        }
      } catch (error) {
        failures.push(
          error instanceof Error
            ? error
            : new Error('Pool destroy cleanup failed', { cause: error })
        )
      } finally {
        this.poolLifecycle.commitStopped()
        this.drainAllWorkerListenerErrors()
      }
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(failures, 'Pool destroy failed')
    }
  }

  private drainAllWorkerListenerErrors (): void {
    this.eventPublisher.drainAll()
  }

  private drainWorkerListenerErrors (owner: 'pool-destroy' | WorkerLease): void {
    this.eventPublisher.drain(owner)
  }

  private flushTasksQueues (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.flushTasksQueue(workerNodeKey)
    }
  }

  private readonly getAbortError = (
    taskName: string,
    taskId: TaskUUID
  ): unknown => {
    const abortSignal = this.taskRegistry.get(taskId)?.abortSignal
    return (
      abortSignal?.reason ??
      new Error(`Task '${taskName}' id '${taskId}' aborted`)
    )
  }

  private getQueuedTasks (): number {
    return this.workerNodes.reduce((accumulator, workerNode) => {
      return accumulator + workerNode.usage.tasks.queued
    }, 0)
  }

  private readonly getTaskFunctionWorkerChoiceStrategy = (
    name?: string
  ): undefined | WorkerChoiceStrategy =>
    this.taskFunctionStore.strategy(
      name,
      this.workerNodesTaskFunctionsProperties()
    )

  private readonly getTaskFunctionWorkerNodeKeysSet = (
    name?: string
  ): ReadonlySet<number> | undefined =>
    this.taskFunctionStore.workerNodeKeys(
      name,
      this.workerNodesTaskFunctionsProperties()
    )

  private getTasksQueuePriority (): boolean {
    return this.taskFunctionStore.usesPriority(
      this.workerNodesTaskFunctionsProperties()
    )
  }

  private readonly getWorkerChoiceStrategies = (): Set<WorkerChoiceStrategy> =>
    this.taskFunctionStore.workerChoiceStrategies(
      this.opts.workerChoiceStrategy ?? WorkerChoiceStrategies.LEAST_USED,
      this.workerNodesTaskFunctionsProperties()
    )

  private getWorkerHandleByLease (
    lease: undefined | WorkerLease
  ): undefined | WorkerHandle<IWorkerNode<Worker, Data>> {
    return lease == null
      ? undefined
      : this.workerLifecycleCoordinator
        .snapshotHandles()
        .find(
          current =>
            current.lease.id === lease.id &&
              current.lease.generation === lease.generation
        )
  }

  private getWorkerNodeKeyByHandle (
    handle: WorkerHandle<IWorkerNode<Worker, Data>>
  ): number {
    return this.workerLifecycleCoordinator.isCurrent(handle)
      ? this.workerNodes.indexOf(handle.worker)
      : -1
  }

  private getWorkerNodeKeyByLease (lease: undefined | WorkerLease): number {
    const handle = this.getWorkerHandleByLease(lease)
    return handle == null ? -1 : this.getWorkerNodeKeyByHandle(handle)
  }

  private readonly getWorkerNodeTaskFunctionPriority = (
    workerNodeKey: number,
    name?: string
  ): number | undefined =>
    this.taskFunctionStore.priority(name, [
      this.getWorkerInfo(workerNodeKey)?.taskFunctionsProperties ?? [],
    ])

  private readonly getWorkerNodeTaskFunctionWorkerChoiceStrategy = (
    workerNodeKey: number,
    name?: string
  ): undefined | WorkerChoiceStrategy =>
    this.taskFunctionStore.strategy(name, [
      this.getWorkerInfo(workerNodeKey)?.taskFunctionsProperties ?? [],
    ])

  private handleTask (
    workerNodeKey: number,
    task: Task<Data>,
    taskCommitted = false
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    const handle = this.workerLifecycleCoordinator.handle(workerNode)
    const permit =
      handle == null
        ? undefined
        : this.workerLifecycleCoordinator.acquireDispatch(handle)
    if (permit == null) return
    if (task.taskId == null) {
      this.taskRouter.routeUntracked(task, permit)
      return
    }
    const record = this.taskRegistry.get(task.taskId)
    if (record == null) return
    if (record.abortSignal?.aborted === true) {
      this.abortTask({
        taskId: task.taskId,
        workerId: record.currentLease?.id ?? record.selectedLease?.id,
      })
      return
    }
    const result = this.taskRouter.route(task.taskId, permit)
    if (taskCommitted && result.kind !== 'committed') {
      this.taskEventState.synchronizeBackPressure()
    }
  }

  private handleTaskExecutionResponse (
    responseLease: WorkerLease,
    message: MessageValue<Response>
  ): void {
    const { data, taskId, workerError, workerId } = message
    if (taskId == null) {
      return
    }
    const record = this.taskRegistry.get(taskId)
    const currentLease = record?.currentLease
    if (workerId !== responseLease.id) {
      return
    }
    if (
      currentLease?.id !== responseLease.id ||
      responseLease.generation !== currentLease.generation
    ) {
      return
    }
    const responseHandle = this.getWorkerHandleByLease(responseLease)
    const workerNodeKey =
      responseHandle == null
        ? -1
        : this.getWorkerNodeKeyByHandle(responseHandle)
    const workerNode =
      workerNodeKey !== -1
        ? this.workerNodes[workerNodeKey]
        : responseHandle?.worker
    const settlement: TaskSettlement<Response> =
      workerError != null
        ? {
            error: this.handleWorkerError(taskId, workerError),
            kind: 'rejected',
          }
        : { kind: 'resolved', value: data as Response }
    const reservationLease =
      record?.state === 'reconciling' ? responseLease : undefined
    const result = this.settleTask(taskId, settlement, reservationLease)
    if (!result.settled) return
    if (reservationLease != null && workerNode != null) {
      this.eventPublisher.publishInternal(
        workerNode,
        'taskExecutionFinished',
        taskId,
        reservationLease
      )
    }
    const accountingWorkerNodeKey = this.getWorkerNodeKeyByLease(
      result.effect.selectedLease
    )
    const selectedWorkerNodeKey =
      accountingWorkerNodeKey !== -1 ? accountingWorkerNodeKey : workerNodeKey
    if (selectedWorkerNodeKey !== -1 && workerNodeKey !== -1) {
      this.afterTaskExecutionHook(
        selectedWorkerNodeKey,
        message,
        workerNodeKey,
        result.effect.taskName
      )
    }
    queueMicrotask(() => {
      const currentWorkerNodeKey =
        responseHandle == null
          ? -1
          : this.getWorkerNodeKeyByHandle(responseHandle)
      if (
        currentWorkerNodeKey !== -1 &&
        this.opts.enableTasksQueue === true &&
        !this.destroying
      ) {
        this.dispatchQueuedTask(currentWorkerNodeKey)
        if (this.isWorkerNodeIdle(currentWorkerNodeKey)) {
          workerNode?.emit('idle', {
            workerId: workerNode.info.id,
            workerNodeKey: currentWorkerNodeKey,
          })
        }
      }
      if (this.shallCreateDynamicWorker()) {
        this.createAndSetupDynamicWorkerNode()
      }
      try {
        if (workerNode != null) {
          this.eventPublisher.publishInternal(
            workerNode,
            'taskFinished',
            taskId,
            reservationLease
          )
        }
      } finally {
        this.taskEventState.checkExecutionFinished(reservationLease)
        if (workerError != null) {
          this.publishPoolEvent(
            PoolEvents.taskError,
            workerError,
            reservationLease
          )
        }
      }
    })
  }

  private readonly handleWorkerError = (
    taskId: TaskUUID,
    workerError: WorkerError
  ): unknown => {
    const { aborted, error, message, name, stack } = workerError
    if (aborted) {
      return this.getAbortError(name ?? DEFAULT_TASK_NAME, taskId)
    }
    if (error != null) {
      return error
    }
    const wError = new Error(message)
    wError.stack = stack
    return wError
  }

  private readonly handleWorkerNodeBackPressureEvent = (
    eventDetail: WorkerNodeEventDetail
  ): void => {
    const workerNode =
      eventDetail.workerNodeKey == null
        ? undefined
        : this.workerNodes[eventDetail.workerNodeKey]
    const handle =
      workerNode == null
        ? undefined
        : this.workerLifecycleCoordinator.handle(workerNode)
    if (handle != null) this.taskStealingController.backPressure(handle)
  }

  private readonly handleWorkerNodeIdleEvent = (
    eventDetail: WorkerNodeEventDetail,
    previousStolenTask?: Task<Data>
  ): void => {
    const eventWorker =
      eventDetail.workerNodeKey == null
        ? undefined
        : this.workerNodes[eventDetail.workerNodeKey]
    const handle =
      eventWorker == null
        ? this.workerLifecycleCoordinator
          .snapshotHandles()
          .find(current => current.lease.id === eventDetail.workerId)
        : this.workerLifecycleCoordinator.handle(eventWorker)
    if (handle != null) {
      this.taskStealingController.idle(
        handle,
        previousStolenTask == null
          ? undefined
          : (previousStolenTask.name ?? DEFAULT_TASK_NAME)
      )
    }
  }

  private async handleWorkerReadyResponse (
    lease: WorkerLease,
    message: MessageValue<Response>
  ): Promise<void> {
    if (this.destroying) return
    const {
      ready,
      staticTaskFunctionsProperties,
      taskFunctionsProperties,
      workerId,
    } = message
    if (ready == null || !ready) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Worker ${workerId?.toString()} failed to initialize`)
    }
    const maxPoolSize =
      this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers
    for (const taskFunctionProperties of taskFunctionsProperties ?? []) {
      checkValidWorkerNodeKeys(
        taskFunctionProperties.workerNodeKeys,
        maxPoolSize
      )
    }
    const workerNodeKey = this.getWorkerNodeKeyByLease(lease)
    if (workerNodeKey === -1) {
      return
    }
    const workerNode = this.workerNodes[workerNodeKey]
    const handle = this.getWorkerHandleByLease(lease)
    if (handle == null) {
      return
    }
    try {
      this.taskFunctionStaticSchema.validate(staticTaskFunctionsProperties)
      const staticDefaultName = this.taskFunctionStaticSchema.defaultName
      if (staticDefaultName == null) {
        throw new TypeError('Worker static task function default is missing')
      }
      await this.taskFunctionTransactionManager.initializeStaticDefault(
        staticDefaultName
      )
      workerNode.info.taskFunctionsProperties = taskFunctionsProperties
      for (;;) {
        const appliedRevision =
          await this.taskFunctionTransactionManager.synchronize(handle)
        const admitted =
          await this.taskFunctionTransactionManager.withStableCatalogAdmission(
            snapshot =>
              snapshot.revision === appliedRevision
                ? this.workerLifecycleCoordinator.markReady(handle)
                : undefined
          )
        if (admitted === true) break
        if (admitted === false) return
      }
    } catch (setupError) {
      return this.rollbackWorkerNodeSetup(workerNode, handle, setupError)
    }
    workerNode.info.ready = true
    this.poolHealthMonitor.refresh()
    this.sendStatisticsMessageToWorker(workerNodeKey)
    this.setTasksQueuePriority(workerNodeKey)
    this.taskEventState.checkReady()
    for (const taskId of this.taskRegistry.snapshotWaitingReady(handle.lease)) {
      const task = this.taskRegistry.get(taskId)?.task
      if (task != null) this.handleTask(workerNodeKey, task, true)
    }
    if (this.opts.enableTasksQueue === true) {
      this.dispatchQueuedTask(workerNodeKey)
    }
  }

  private hasActiveExecutionForWorkerId (workerId: number | undefined): boolean {
    const handle = this.workerLifecycleCoordinator
      .snapshotHandles()
      .find(current => current.lease.id === workerId)
    return handle != null && this.taskRegistry.hasActiveExecution(handle.lease)
  }

  private initWorkerNodeUsage (workerNode: IWorkerNode<Worker, Data>): void {
    const taskStatisticsRequirements =
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
    if (taskStatisticsRequirements?.runTime.aggregate === true) {
      workerNode.usage.runTime.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.runTime.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
    if (taskStatisticsRequirements?.waitTime.aggregate === true) {
      workerNode.usage.waitTime.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.waitTime.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
    if (taskStatisticsRequirements?.elu.aggregate === true) {
      workerNode.usage.elu.active.aggregate = min(
        ...this.workerNodes.map(
          workerNode =>
            workerNode.usage.elu.active.aggregate ?? Number.POSITIVE_INFINITY
        )
      )
    }
  }

  private async internalExecute (
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: readonly Transferable[]
  ): Promise<Response> {
    return await this.taskFunctionTransactionManager.withStableCatalogAdmission(
      () =>
        new Promise<Response>((resolve, reject) => {
          if (!this.started) {
            throw new WorkerTerminationError('Worker node terminated by pool')
          }
          // Recompute health before the read: the breaker trips synchronously in
          // shouldReplace(), but the topology-driven refresh that latches #state
          // only lands at reconciliation finalize. This closes the staleness
          // window so an unrecoverable pool fast-fails on submission.
          this.poolHealthMonitor.refresh()
          if (this.poolHealthMonitor.unrecoverable) {
            throw new PoolUnrecoverableError('Pool has no recoverable worker')
          }
          const taskId = randomUUID()
          const task: Task<Data> & { readonly taskId: TaskUUID } = {
            abortable: abortSignal != null,
            data: data ?? ({} as Data),
            name: name ?? DEFAULT_TASK_NAME,
            priority: this.getWorkerNodeTaskFunctionPriority(0, name),
            strategy: this.getWorkerNodeTaskFunctionWorkerChoiceStrategy(
              0,
              name
            ),
            taskId,
            timestamp: performance.now(),
            transferList,
          }
          this.taskScheduler.register({
            abortSignal,
            onAbort: currentTaskId => {
              this.abortTask({ taskId: currentTaskId })
            },
            reject,
            resolve,
            task,
            ...(this.emitter != null && {
              asyncResource: new AsyncResource('poolifier:task', {
                requireManualDestroy: true,
                triggerAsyncId: this.emitter.asyncId,
              }),
            }),
          })
          if (this.taskRegistry.get(taskId) == null) return
          const permit = this.workerAdmission.acquire(name)
          if (permit == null) {
            this.rejectTaskPromise(
              taskId,
              undefined,
              new Error('No eligible worker is available')
            )
            return
          }
          this.taskRouter.route(taskId, permit)
          this.taskEventState.checkExecutionStarted()
        }),
      abortSignal
    )
  }

  private isWorkerNodeBackPressured (workerNodeKey: number): boolean {
    const workerNode = this.readyWorkerNodeAt(workerNodeKey)
    if (workerNode == null) {
      return false
    }
    return workerNode.info.backPressure
  }

  private isWorkerNodeBusy (workerNodeKey: number): boolean {
    const workerNode = this.readyWorkerNodeAt(workerNodeKey)
    if (workerNode == null) {
      return false
    }
    if (this.opts.enableTasksQueue === true) {
      return (
        workerNode.usage.tasks.executing >=
        (this.opts.tasksQueueOptions?.concurrency ?? 1)
      )
    }
    return workerNode.usage.tasks.executing > 0
  }

  private isWorkerNodeIdle (workerNodeKey: number): boolean {
    const workerNode = this.readyWorkerNodeAt(workerNodeKey)
    if (workerNode == null) {
      return false
    }
    if (this.opts.enableTasksQueue === true) {
      return (
        workerNode.usage.tasks.executing === 0 &&
        this.tasksQueueSize(workerNodeKey) === 0
      )
    }
    return workerNode.usage.tasks.executing === 0
  }

  private isWorkerNodeStealing (workerNodeKey: number): boolean {
    const workerNode = this.readyWorkerNodeAt(workerNodeKey)
    if (workerNode == null) {
      return false
    }
    return (
      workerNode.info.continuousStealing || workerNode.info.backPressureStealing
    )
  }

  private readyWorkerNodeAt (
    workerNodeKey: number
  ): IWorkerNode<Worker, Data> | undefined {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return workerNode?.info.ready ? workerNode : undefined
  }

  private readyWorkerNodeCount (): number {
    return this.workerNodes.reduce(
      (accumulator, workerNode) =>
        !workerNode.info.dynamic && workerNode.info.ready
          ? accumulator + 1
          : accumulator,
      0
    )
  }

  private rejectOwnedTasks (
    handle: WorkerHandle<IWorkerNode<Worker, Data>>,
    baseError: WorkerCrashError
  ): WorkerCrashError {
    const taskIds = [
      ...new Set(this.taskRegistry.snapshotByLease(handle.lease)),
    ]
    this.taskScheduler.reserveForReconciliation(taskIds, handle.lease)
    const activeTaskIds = new Set(
      this.taskRegistry.snapshotActiveReconciliationTaskIds(
        taskIds,
        handle.lease
      )
    )
    const attributedTaskId =
      activeTaskIds.size === 1 ? activeTaskIds.values().next().value : undefined
    const orderedTaskIds = [
      ...taskIds.filter(taskId => activeTaskIds.has(taskId)),
      ...taskIds.filter(taskId => !activeTaskIds.has(taskId)),
    ]
    let firstActiveSettledError: undefined | WorkerCrashError
    let firstSettledError: undefined | WorkerCrashError
    for (const taskId of orderedTaskIds) {
      const taskError = this.workerReconciliationPolicy.buildTaskCrashError(
        baseError,
        handle.worker,
        taskId,
        taskId === attributedTaskId
      )
      try {
        if (
          this.rejectTaskPromise(taskId, handle.worker, taskError, handle.lease)
        ) {
          firstSettledError ??= taskError
          if (activeTaskIds.has(taskId)) {
            firstActiveSettledError ??= taskError
          }
        }
      } catch (error) {
        this.eventPublisher.defer(error, handle.lease)
      }
    }
    return firstActiveSettledError ?? firstSettledError ?? baseError
  }

  private rejectTaskPromise (
    taskId: TaskUUID,
    workerNode: IWorkerNode<Worker, Data> | undefined,
    error: unknown,
    lifecycleLease?: WorkerLease
  ): boolean {
    const result = this.taskScheduler.reject(taskId, error, lifecycleLease)
    if (result.kind !== 'settled' || result.settlement == null) return false
    if (result.settlement.settled) {
      this.eventPublisher.deferAll(
        result.settlement.secondaryErrors,
        lifecycleLease
      )
    }
    this.applyRejectedTaskSettlement(
      taskId,
      result.settlement,
      result.handle?.worker ?? workerNode,
      lifecycleLease
    )
    return result.settlement.settled
  }

  private removeWorkerNode (workerNode: IWorkerNode<Worker, Data>): void {
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey !== -1) {
      const handle = this.workerLifecycleCoordinator.handle(workerNode)
      if (handle != null) this.taskStealingController.cancel(handle)
      this.workerNodes.splice(workerNodeKey, 1)
      this.taskEventState.readyEventEmitted = false
      this.workerChoiceStrategiesContext?.remove(workerNodeKey)
      workerNode.info.dynamic &&
        this.checkAndEmitDynamicWorkerDestructionEvents()
    }
  }

  private rollbackWorkerNodeSetup (
    workerNode: IWorkerNode<Worker, Data>,
    handle: undefined | WorkerHandle<IWorkerNode<Worker, Data>>,
    setupError: unknown
  ): never {
    if (handle == null) {
      this.removeWorkerNode(workerNode)
      const termination = workerNode.terminate()
      termination.catch((cleanupError: unknown) => {
        this.publishPoolError(cleanupError)
      })
    } else {
      this.trackWorkerReconciliation(
        handle.lease,
        this.workerLifecycleCoordinator.setupFailed(handle, setupError)
      )
    }
    throw setupError
  }

  private sendStatisticsMessageToWorker (workerNodeKey: number): void {
    const taskStatisticsRequirements =
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
    this.sendToWorker(workerNodeKey, {
      statistics: {
        elu: taskStatisticsRequirements?.elu.aggregate ?? false,
        runTime: taskStatisticsRequirements?.runTime.aggregate ?? false,
      },
    })
  }

  private setTasksQueuePriority (workerNodeKey: number): void {
    this.workerNodes[workerNodeKey].setTasksQueuePriority(
      this.getTasksQueuePriority()
    )
  }

  private setTasksQueueSize (size: number): void {
    for (const workerNode of this.workerNodes) {
      workerNode.tasksQueueBackPressureSize = size
    }
  }

  private setTasksStealingOnBackPressure (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].on(
        'backPressure',
        this.handleWorkerNodeBackPressureEvent
      )
    }
  }

  private setTaskStealing (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].on('idle', this.handleWorkerNodeIdleEvent)
    }
  }

  private settleTask (
    taskId: TaskUUID,
    settlement: TaskSettlement<Response>,
    lifecycleLease?: WorkerLease
  ): SettlementResult {
    const result = this.taskScheduler.settle(taskId, settlement, lifecycleLease)
    this.applyTaskSettlementErrors(result, lifecycleLease)
    return result
  }

  private shallUpdateTaskFunctionWorkerUsage (workerNodeKey: number): boolean {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    return (
      workerInfo != null &&
      hasMultipleTaskFunctions(workerInfo.taskFunctionsProperties)
    )
  }

  private startMinimumNumberOfWorkers (initWorkerNodeUsage = false): void {
    if (this.minimumNumberOfWorkers === 0) {
      return
    }
    while (
      this.workerNodes.reduce(
        (accumulator, workerNode) =>
          !workerNode.info.dynamic ? accumulator + 1 : accumulator,
        0
      ) < this.minimumNumberOfWorkers
    ) {
      const workerNodeKey = this.createAndSetupWorkerNode()
      if (workerNodeKey == null) return
      initWorkerNodeUsage &&
        this.initWorkerNodeUsage(this.workerNodes[workerNodeKey])
    }
  }

  private startWorkerNodeCrashHandling (
    handle: WorkerHandle<IWorkerNode<Worker, Data>>,
    cause: Error
  ): void {
    this.workerTerminalController.error(handle, cause)
  }

  private startWorkerNodeExitHandling (
    handle: WorkerHandle<IWorkerNode<Worker, Data>>,
    exitCode: null | number,
    signal?: NodeJS.Signals | null
  ): void {
    this.workerTerminalController.exit(handle, exitCode, signal)
  }

  private tasksQueueSize (workerNodeKey: number): number {
    const workerNode = this.workerNodes[workerNodeKey]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workerNode == null) {
      return 0
    }
    return workerNode.tasksQueueSize()
  }

  private async terminateWorkerNode (
    input: WorkerReconciliationInput<IWorkerNode<Worker, Data>>,
    signal: AbortSignal
  ): Promise<void> {
    signal.throwIfAborted()
    await this.workerTerminalController.terminate(input.handle, async () => {
      await input.handle.worker.terminate()
    })
    signal.throwIfAborted()
  }

  private trackWorkerReconciliation (
    lease: WorkerLease,
    reconciliation: Promise<WorkerReconciliationResult>
  ): void {
    this.poolLifecycle.track(reconciliation)
    if (this.publishedWorkerReconciliations.has(reconciliation)) return
    this.publishedWorkerReconciliations.add(reconciliation)
    reconciliation
      .catch((error: unknown) => {
        this.publishPoolError(error, lease)
        if (this.destroying) {
          this.transferWorkerListenerErrors(lease)
        } else {
          this.drainWorkerListenerErrors(lease)
        }
      })
      .catch((error: unknown) => {
        queueMicrotask(() => {
          throw error
        })
      })
  }

  private transferWorkerListenerErrors (lease: WorkerLease): void {
    this.eventPublisher.transfer(lease, 'pool-destroy')
  }

  private unsetTasksStealingOnBackPressure (): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].off(
        'backPressure',
        this.handleWorkerNodeBackPressureEvent
      )
    }
  }

  private unsetTaskStealing (): void {
    this.taskStealingController.cancelAll()
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].off(
        'idle',
        this.handleWorkerNodeIdleEvent
      )
    }
  }

  private updateTaskSequentiallyStolenStatisticsWorkerUsage (
    workerNodeKey: number,
    taskName?: string,
    previousTaskName?: string
  ): void {
    this.taskUsageAccounting.updateSequentiallyStolen(
      workerNodeKey,
      taskName,
      previousTaskName
    )
  }

  private updateTaskStolenStatisticsWorkerUsage (
    workerNodeKey: number,
    taskName: string
  ): void {
    this.taskUsageAccounting.updateStolen(workerNodeKey, taskName)
  }

  private workerNodesTaskFunctionsProperties (): TaskFunctionProperties[][] {
    return this.workerNodes.map(
      workerNode => workerNode.info.taskFunctionsProperties ?? []
    )
  }
}
