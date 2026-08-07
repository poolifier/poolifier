/* eslint-disable perfectionist/sort-intersection-types, perfectionist/sort-modules, perfectionist/sort-object-types, perfectionist/sort-union-types */
import type { AsyncResource } from 'node:async_hooks'

import type { Task, TaskUUID } from '../utility-types.js'

export type WorkerLease = Readonly<{ id: number; generation: number }>

export type WorkerHandle<Worker> = Readonly<{
  lease: WorkerLease
  worker: Worker
}>

export type DispatchPermit<Worker> = Readonly<{
  handle: WorkerHandle<Worker>
  readiness: 'awaitingReady' | 'ready'
}>

export interface LifecycleWorker {
  readonly info: Readonly<{ dynamic: boolean; id?: number }>
}

export type WorkerReconciliationClassification =
  | 'draining'
  | 'exited'
  | 'faulted'

export type WorkerReconciliationResult = Readonly<{
  cause: unknown
  classification?: WorkerReconciliationClassification
  committed: boolean
  exit?: WorkerExit
  lease: WorkerLease
}>

export type WorkerCompletionInput<Worker extends LifecycleWorker> = Readonly<{
  reconciliationValue: unknown
  transition: WorkerReconciliationInput<Worker>
}>

export type ReconciliationReservation = Readonly<{
  lease: WorkerLease
  previousState: Exclude<TaskState, 'reconciling' | 'settled'>
  taskId: TaskUUID
}>

export interface WorkerReconciliationPreparation {
  readonly finalizeResidual: (signal: AbortSignal) => unknown
  readonly prepare: (signal: AbortSignal) => Promise<unknown>
  readonly prepareTimeoutMs?: number
  readonly restore: (signal: AbortSignal) => Promise<void>
}

export type WorkerExit = Readonly<{
  code: null | number
  signal?: NodeJS.Signals | null
}>

export type WorkerTerminalObservation = Readonly<{
  cause: unknown
  classification: Exclude<WorkerReconciliationClassification, 'draining'>
  exit?: WorkerExit
}>

export interface WorkerLifecycleCallbacks<Worker extends LifecycleWorker> {
  readonly complete: (
    input: WorkerCompletionInput<Worker>,
    signal: AbortSignal
  ) => Promise<void>
  readonly drain: (
    handle: WorkerHandle<Worker>,
    signal: AbortSignal
  ) => Promise<void>
  readonly exclude: (
    handle: WorkerHandle<Worker>,
    signal: AbortSignal
  ) => unknown
  readonly isPoolRunning: (signal: AbortSignal) => boolean
  readonly reconcile: (
    input: WorkerReconciliationInput<Worker>,
    signal: AbortSignal
  ) => unknown
  readonly remove: (
    handle: WorkerHandle<Worker>,
    signal: AbortSignal
  ) => unknown
  readonly replace: (
    input: WorkerReplacementInput<Worker>,
    signal: AbortSignal
  ) => Promise<void>
  readonly shouldReplace: (
    input: WorkerReplacementInput<Worker>,
    signal: AbortSignal
  ) => boolean
  readonly snapshotOwnedWork: (lease: WorkerLease) => readonly TaskUUID[]
  readonly terminate: (
    input: WorkerReconciliationInput<Worker>,
    signal: AbortSignal
  ) => Promise<void>
}

export type TopologyChangeListener = (epoch: number) => void

export type WorkerReconciliationContext<Worker extends LifecycleWorker> =
  Readonly<{
    baseTransition: WorkerReconciliationInput<Worker>
    command: WorkerLifecycleCommand<Worker>
    finalize: (signal: AbortSignal) => unknown
    transition: () => WorkerReconciliationInput<Worker>
  }>

export type WorkerReconciliationInput<Worker extends LifecycleWorker> =
  Readonly<{
    cause: unknown
    classification: WorkerReconciliationClassification
    exit?: WorkerExit
    handle: WorkerHandle<Worker>
    ownedTaskIds: readonly TaskUUID[]
    previousState: WorkerState
  }>

export type WorkerReplacementInput<Worker extends LifecycleWorker> = Readonly<{
  classification: WorkerReconciliationClassification
  handle: WorkerHandle<Worker>
}>

export type WorkerState =
  | 'awaitingReady'
  | 'draining'
  | 'exited'
  | 'faulted'
  | 'provisioning'
  | 'ready'
  | 'removed'

export interface WorkerLifecycleCommand<Worker> {
  readonly allowReplacement: boolean
  readonly cause: unknown
  readonly classification: WorkerReconciliationClassification
  readonly excluded?: boolean
  readonly exclusionError?: unknown
  readonly handle: WorkerHandle<Worker>
}

export interface WorkerLifecycleSlot<Worker> {
  cause?: unknown
  exclusionError?: unknown
  exit?: { code: null | number; signal?: NodeJS.Signals | null }
  readonly handle: WorkerHandle<Worker>
  reconciliation?: Promise<WorkerReconciliationResult>
  reconciliationPreviousState?: WorkerState
  state: WorkerState
  terminalClassification?: WorkerReconciliationClassification
}

export type TaskState =
  | 'registered'
  | 'waitingReady'
  | 'queued'
  | 'assigned'
  | 'dispatching'
  | 'running'
  | 'cancelling'
  | 'detached'
  | 'reconciling'
  | 'settled'

export type TaskSettlement<Response = unknown> =
  | Readonly<{ kind: 'resolved'; value: Response }>
  | Readonly<{ kind: 'rejected'; error: unknown }>

export type TransitionResult = Readonly<{
  committed: boolean
  previous: TaskState
  current: TaskState
}>

export type TransitionFailure = 'missing' | 'state_mismatch'

export type RegistryTransition =
  | Readonly<{ ok: true; previous: TaskState; current: TaskState }>
  | Readonly<{ ok: false; reason: TransitionFailure }>

export type AccountingEffect = Readonly<{
  activeLease?: WorkerLease
  executionStarted: boolean
  selectedLease?: WorkerLease
  taskName: string
  outcome?: 'executed' | 'failed'
}>

export type SettlementResult =
  | Readonly<{ settled: false }>
  | Readonly<{
    effect: AccountingEffect
    secondaryErrors: readonly unknown[]
    settled: true
  }>

export type AbortDecision =
  | Readonly<{
    kind: 'noop'
    reason: 'missing' | 'settled' | 'already_cancelling' | 'reconciling'
  }>
  | Readonly<{
    kind: 'defer-dispatch'
  }>
  | Readonly<{
    kind: 'settle-local'
    state: 'registered' | 'waitingReady' | 'queued' | 'assigned' | 'detached'
    error: unknown
    lease?: WorkerLease
  }>
  | Readonly<{ kind: 'send-running-abort'; lease: WorkerLease }>

export interface RegisterTaskInput<Data, Response> {
  readonly abortSignal?: AbortSignal
  readonly asyncResource?: AsyncResource
  readonly onAbort: (taskId: TaskUUID) => void
  readonly reject: (reason?: unknown) => void
  readonly resolve: (value: PromiseLike<Response> | Response) => void
  readonly selectedLease?: WorkerLease
  readonly task: Task<Data> & Readonly<{ taskId: TaskUUID }>
}

export interface TaskRecord<Data, Response> {
  readonly abortListener?: () => void
  readonly abortSignal?: AbortSignal
  activeOnReconciliation?: boolean
  readonly asyncResource?: AsyncResource
  currentLease?: WorkerLease
  readonly reject: (reason?: unknown) => void
  readonly resolve: (value: PromiseLike<Response> | Response) => void
  selectedLease?: WorkerLease
  state: TaskState
  readonly task: Task<Data> & Readonly<{ taskId: TaskUUID }>
}
