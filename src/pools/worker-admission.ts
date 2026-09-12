import type { DispatchPermit, WorkerHandle } from './lifecycle-types.js'
import type { TaskRegistry } from './task-registry.js'
import type { WorkerLifecycleCoordinator } from './worker-lifecycle-coordinator.js'

export interface WorkerAdmissionCallbacks<Worker, Strategy> {
  readonly affinity: (name?: string) => ReadonlySet<number> | undefined
  readonly createWorker: () => void
  readonly isPoolActive: () => boolean
  readonly maxWorkers: number
  readonly select: (
    strategy: Strategy | undefined,
    candidates: ReadonlySet<number>
  ) => number | undefined
  readonly shouldCreateWorker?: () => boolean
  readonly strategy: (name?: string) => Strategy | undefined
  readonly workerCount: () => number
  readonly workerNodeKey: (handle: WorkerHandle<Worker>) => number
}

export class WorkerAdmission<Worker, Data, Response, Strategy> {
  public constructor (
    private readonly coordinator: Pick<
      WorkerLifecycleCoordinator<
        Worker & { readonly info: { readonly dynamic: boolean } }
      >,
      'acquireDispatch' | 'snapshotHandles' | 'state'
    >,
    private readonly registry: Pick<
      TaskRegistry<Data, Response>,
      'size' | 'waitingReadyCount'
    >,
    private readonly callbacks: WorkerAdmissionCallbacks<Worker, Strategy>
  ) {}

  public acquire (name?: string): DispatchPermit<Worker> | undefined {
    const affinity = this.callbacks.affinity(name)
    this.provisionForAffinity(affinity)
    if (
      affinity == null &&
      this.canCreateWorker() &&
      (this.hasUnmetDemand() || this.callbacks.shouldCreateWorker?.() === true)
    ) {
      this.callbacks.createWorker()
    }
    return this.admit(name, affinity, true)
  }

  private admit (
    name: string | undefined,
    affinity: ReadonlySet<number> | undefined,
    retry: boolean
  ): DispatchPermit<Worker> | undefined {
    const candidates = this.coordinator
      .snapshotHandles()
      .map(handle => ({
        handle,
        key: this.callbacks.workerNodeKey(handle),
        state: this.coordinator.state(handle),
      }))
      .filter(
        candidate =>
          candidate.key !== -1 &&
          (affinity == null || affinity.has(candidate.key))
      )
    const ready = candidates.filter(candidate => candidate.state === 'ready')
    let tier = ready
    let readiness: DispatchPermit<Worker>['readiness'] = 'ready'
    if (tier.length === 0) {
      const awaiting = candidates.filter(
        candidate => candidate.state === 'awaitingReady'
      )
      const minimumWaiting = Math.min(
        ...awaiting.map(candidate =>
          this.registry.waitingReadyCount(candidate.handle.lease)
        )
      )
      tier = awaiting.filter(
        candidate =>
          this.registry.waitingReadyCount(candidate.handle.lease) ===
          minimumWaiting
      )
      readiness = 'awaitingReady'
    }
    if (tier.length === 0) {
      if (affinity == null && this.canCreateWorker()) {
        this.callbacks.createWorker()
        return retry ? this.admit(name, affinity, false) : undefined
      }
      return undefined
    }
    const selectedKey =
      readiness === 'ready'
        ? this.callbacks.select(
          this.callbacks.strategy(name),
          new Set(tier.map(candidate => candidate.key))
        )
        : tier[0]?.key
    const selected = tier.find(candidate => candidate.key === selectedKey)
    const permit =
      selected == null
        ? undefined
        : this.coordinator.acquireDispatch(selected.handle)
    if (permit?.readiness === readiness) return permit
    return retry ? this.admit(name, affinity, false) : undefined
  }

  private canCreateWorker (): boolean {
    return (
      this.callbacks.isPoolActive() &&
      this.callbacks.workerCount() < this.callbacks.maxWorkers
    )
  }

  private hasUnmetDemand (): boolean {
    const availableCapacity = this.coordinator
      .snapshotHandles()
      .reduce((capacity, handle) => {
        const state = this.coordinator.state(handle)
        return state === 'ready' || state === 'awaitingReady'
          ? capacity + 1
          : capacity
      }, 0)
    return this.registry.size > availableCapacity
  }

  private provisionForAffinity (
    affinity: ReadonlySet<number> | undefined
  ): void {
    if (affinity == null || affinity.size === 0) return
    const targetSize = Math.max(...affinity) + 1
    while (
      this.callbacks.workerCount() < targetSize &&
      this.canCreateWorker()
    ) {
      this.callbacks.createWorker()
    }
  }
}
