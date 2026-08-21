import type {
  LifecycleWorker,
  TopologyChangeListener,
  WorkerHandle,
  WorkerLifecycleSlot,
  WorkerReconciliationResult,
} from './lifecycle-types.js'

import { compareWorkerHandles } from './worker-lifecycle-state.js'

export class WorkerTopologyRegistry<
  Worker extends LifecycleWorker = LifecycleWorker
> {
  public get epoch (): number {
    return this.#epoch
  }

  readonly #currentById = new Map<number, WorkerLifecycleSlot<Worker>>()
  #epoch = 0
  #generation = 0
  readonly #listeners = new Set<TopologyChangeListener>()
  readonly #slots = new WeakMap<Worker, WorkerLifecycleSlot<Worker>>()

  public advance (): void {
    this.#epoch++
    for (const listener of this.#listeners) listener(this.#epoch)
  }

  public finalize (slot: WorkerLifecycleSlot<Worker>): void {
    slot.state = 'removed'
    if (this.#currentById.get(slot.handle.lease.id) === slot) {
      this.#currentById.delete(slot.handle.lease.id)
    }
    this.advance()
  }

  public handle (worker: Worker): undefined | WorkerHandle<Worker> {
    return this.#slots.get(worker)?.handle
  }

  public isCurrent (handle: WorkerHandle<Worker>): boolean {
    const slot = this.slot(handle)
    return (
      slot != null &&
      slot.state !== 'removed' &&
      this.#currentById.get(handle.lease.id) === slot
    )
  }

  public register (worker: Worker): WorkerHandle<Worker> {
    const id = worker.info.id
    if (id == null) throw new TypeError('Worker node ID must be defined')
    const generation = this.#generation + 1
    if (!Number.isSafeInteger(generation)) {
      throw new RangeError('Worker generation counter exhausted')
    }
    const lease = { generation, id }
    const handle = { lease, worker }
    const slot: WorkerLifecycleSlot<Worker> = { handle, state: 'provisioning' }
    this.#generation = generation
    this.#currentById.set(id, slot)
    this.#slots.set(worker, slot)
    this.advance()
    return handle
  }

  public resolve (handle: WorkerHandle<Worker>): undefined | Worker {
    return this.isCurrent(handle) ? handle.worker : undefined
  }

  public slot (
    handle: WorkerHandle<Worker>
  ): undefined | WorkerLifecycleSlot<Worker> {
    const slot = this.#slots.get(handle.worker)
    return slot?.handle.lease.generation === handle.lease.generation &&
      slot.handle.lease.id === handle.lease.id
      ? slot
      : undefined
  }

  public snapshotHandles (): readonly WorkerHandle<Worker>[] {
    return [...this.#currentById.values()].map(slot => slot.handle)
  }

  public snapshotPromises (): readonly Promise<WorkerReconciliationResult>[] {
    return [...this.#currentById.values()].flatMap(slot =>
      slot.reconciliation == null ? [] : [slot.reconciliation]
    )
  }

  public snapshotReadyHandles (): readonly WorkerHandle<Worker>[] {
    return [...this.#currentById.values()]
      .filter(slot => slot.state === 'ready')
      .map(slot => slot.handle)
      .sort(compareWorkerHandles)
  }

  public subscribe (listener: TopologyChangeListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
}
