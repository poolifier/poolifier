export type WorkerReconciliationFailure = Readonly<{
  error: unknown
  stage: WorkerReconciliationStage
}>

export type WorkerReconciliationStage =
  | 'complete'
  | 'drain'
  | 'exclude'
  | 'finalize'
  | 'finalizeResidual'
  | 'isPoolRunning'
  | 'prepare'
  | 'remove'
  | 'replace'
  | 'restore'
  | 'shouldReplace'
  | 'terminate'

export class WorkerReconciliationError extends Error {
  public readonly failures: readonly WorkerReconciliationFailure[]
  public override readonly name = 'WorkerReconciliationError'
  public readonly secondaryFailures: readonly WorkerReconciliationFailure[]
  public readonly stage: WorkerReconciliationStage

  public constructor (failures: readonly WorkerReconciliationFailure[]) {
    const primary = failures[0]
    super(`Worker reconciliation failed during '${primary.stage}'`, {
      cause: primary.error,
    })
    this.stage = primary.stage
    this.failures = Object.freeze([...failures])
    this.secondaryFailures = Object.freeze(failures.slice(1))
  }
}

export class WorkerReconciliationTimeoutError extends Error {
  public override readonly name = 'WorkerReconciliationTimeoutError'

  public constructor (
    public readonly stage: WorkerReconciliationStage,
    public readonly timeoutMs: number
  ) {
    super(
      `Worker reconciliation '${stage}' timed out after ${timeoutMs.toString()}ms`
    )
  }
}
