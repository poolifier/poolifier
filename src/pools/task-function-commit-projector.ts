import type { TaskFunctionCatalogSnapshot } from './task-function-catalog.js'

export interface TaskFunctionCommitProjectionCallbacks<Data, Response> {
  readonly defer: (error: unknown) => void
  readonly projectRemovedUsage: (name: string, workerNodeKey: number) => void
  readonly report: (
    error: unknown,
    snapshot: TaskFunctionCatalogSnapshot<Data, Response>
  ) => void
  readonly sendStatistics: (workerNodeKey: number) => void
  readonly synchronizeStrategies: () => void
  readonly workerNodeKeys: () => Iterable<number>
}

export class TaskFunctionCommitProjector<Data = unknown, Response = unknown> {
  public constructor (
    private readonly callbacks: TaskFunctionCommitProjectionCallbacks<
      Data,
      Response
    >
  ) {}

  public project (
    snapshot: TaskFunctionCatalogSnapshot<Data, Response>,
    previous: TaskFunctionCatalogSnapshot<Data, Response>
  ): void {
    const committedNames = new Set(snapshot.entries.map(entry => entry.name))
    const workerNodeKeys = [...this.callbacks.workerNodeKeys()]
    for (const entry of previous.entries) {
      if (committedNames.has(entry.name)) continue
      for (const workerNodeKey of workerNodeKeys) {
        this.#attempt(snapshot, () => {
          this.callbacks.projectRemovedUsage(entry.name, workerNodeKey)
        })
      }
    }
    this.#attempt(snapshot, () => {
      this.callbacks.synchronizeStrategies()
    })
    for (const workerNodeKey of workerNodeKeys) {
      this.#attempt(snapshot, () => {
        this.callbacks.sendStatistics(workerNodeKey)
      })
    }
  }

  #attempt (
    snapshot: TaskFunctionCatalogSnapshot<Data, Response>,
    projection: () => void
  ): void {
    try {
      projection()
    } catch (error) {
      // no-excuse-ok: catch -- independent projections report and continue
      try {
        this.callbacks.report(error, snapshot)
      } catch (reportingError) {
        // no-excuse-ok: catch -- reporting cannot interrupt later projections
        this.callbacks.defer(reportingError)
      }
    }
  }
}
