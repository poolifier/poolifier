import { resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const typeOnlyClasses = [
  'AbstractPool',
  'AbstractWorker',
  'CircularBuffer',
  'PriorityQueue',
  'WorkerChoiceStrategiesContext',
]

it('preserves public class and task function contracts', () => {
  const file = resolve('tests/declaration-consumer.mts').replaceAll('\\', '/')
  const source = `
    import type { Worker, MessagePort } from 'node:worker_threads'
    import type { AbstractPool, AbstractWorker, CircularBuffer, PriorityQueue, Task, TaskAsyncFunction, TaskFunction, TaskFunctions, TaskSyncFunction, WorkerChoiceStrategiesContext, WorkerOptions } from 'poolifier'
    import { FixedThreadPool, DynamicThreadPool, FixedClusterPool, DynamicClusterPool, ThreadWorker, ClusterWorker } from 'poolifier'
    export type Instances = [AbstractPool<Worker>, AbstractWorker<MessagePort>, CircularBuffer, PriorityQueue<number>, WorkerChoiceStrategiesContext<Worker>]
    export type Constructors = [typeof AbstractPool, typeof AbstractWorker, typeof CircularBuffer, typeof PriorityQueue, typeof WorkerChoiceStrategiesContext]
    export const publicConstructors = [FixedThreadPool, DynamicThreadPool, FixedClusterPool, DynamicClusterPool, ThreadWorker, ClusterWorker]
    export abstract class CompatibleWorker extends ThreadWorker<number, number> {
      protected abstract override readonly runAsync: (fn: TaskAsyncFunction<number, number>, task: Task<number>) => void
      protected abstract override readonly runSync: (fn: TaskSyncFunction<number, number>, task: Task<number>) => void
    }
    declare const result: PromiseLike<number>
    declare const cleanup: PromiseLike<void>
    export const task: TaskFunction<number, number> = () => result
    export const mixedTask: TaskFunction<number, number> = data => data == null ? result : data
    export const functions: TaskFunctions<number, number> = { task, wrapped: { taskFunction: mixedTask } }
    export const options: WorkerOptions = { killHandler: () => cleanup }
    export const threadWorker = new ThreadWorker<number, number>(task, options)
    export const clusterWorker = new ClusterWorker<number, number>(functions, options)
    declare const threadPool: FixedThreadPool<number, number>
    declare const clusterPool: FixedClusterPool<number, number>
    void threadPool.addTaskFunction('thenable', task)
    void clusterPool.addTaskFunction('mixed', { taskFunction: mixedTask })
    declare const wrongResult: PromiseLike<string>
    // @ts-expect-error A thenable must fulfill with the declared response type.
    export const wrongTask: TaskFunction<number, number> = () => wrongResult
    // @ts-expect-error Protected async dispatch retains its native Promise contract.
    export const protectedAsync: TaskAsyncFunction<number, number> = () => result
    ${typeOnlyClasses
      .map(
        name => `
      // @ts-expect-error A type-only class export cannot be imported as a value.
      import { ${name} as ${name}Value } from 'poolifier'
      // @ts-expect-error A type-only class export cannot be used as a value.
      void ${name}Value
    `
      )
      .join('\n')}
  `
  const options = {
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: ['node'],
    verbatimModuleSyntax: true,
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (name, ...args) =>
    name === file
      ? ts.createSourceFile(name, source, options.target, true)
      : getSourceFile(name, ...args)
  const program = ts.createProgram([file], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  expect(
    diagnostics.map(diagnostic =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
  ).toEqual([])
})
