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

it('preserves type-only class exports and their constructor-side types', () => {
  const file = resolve('tests/declaration-consumer.mts').replaceAll('\\', '/')
  const source = `
    import type { Worker, MessagePort } from 'node:worker_threads'
    import type { AbstractPool, AbstractWorker, CircularBuffer, PriorityQueue, Task, TaskAsyncFunction, TaskSyncFunction, WorkerChoiceStrategiesContext } from 'poolifier'
    import { FixedThreadPool, DynamicThreadPool, FixedClusterPool, DynamicClusterPool, ThreadWorker, ClusterWorker } from 'poolifier'
    export type Instances = [AbstractPool<Worker>, AbstractWorker<MessagePort>, CircularBuffer, PriorityQueue<number>, WorkerChoiceStrategiesContext<Worker>]
    export type Constructors = [typeof AbstractPool, typeof AbstractWorker, typeof CircularBuffer, typeof PriorityQueue, typeof WorkerChoiceStrategiesContext]
    export const publicConstructors = [FixedThreadPool, DynamicThreadPool, FixedClusterPool, DynamicClusterPool, ThreadWorker, ClusterWorker]
    export abstract class CompatibleWorker extends ThreadWorker<number, number> {
      protected abstract override readonly runAsync: (fn: TaskAsyncFunction<number, number>, task: Task<number>) => void
      protected abstract override readonly runSync: (fn: TaskSyncFunction<number, number>, task: Task<number>) => void
    }
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
