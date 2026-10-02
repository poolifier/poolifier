import { describe, expect, it } from 'vitest'

import { TaskFunctionStaticSchema } from '../../../lib/pools/task-function-static-schema.mjs'
import { DEFAULT_TASK_NAME } from '../../../lib/utils.mjs'

describe('TaskFunctionStaticSchema', () => {
  it('accepts identical static schemas and exposes their names', () => {
    const schema = new TaskFunctionStaticSchema()
    const properties = [
      { name: DEFAULT_TASK_NAME, priority: 1 },
      { name: 'factorial', priority: 1 },
    ]

    schema.validate(properties)

    expect(schema.validate(properties)).toStrictEqual(properties)
    expect(schema.defaultName).toBe('factorial')
    expect(schema.has('factorial')).toBe(true)
  })

  it('rejects a schema without a concrete logical default', () => {
    const schema = new TaskFunctionStaticSchema()

    expect(() =>
      schema.validate([
        { name: DEFAULT_TASK_NAME },
        { name: DEFAULT_TASK_NAME },
      ])
    ).toThrow('Worker static task function default is invalid')
    expect(schema.defaultName).toBeUndefined()
  })

  it('rejects a worker whose static task properties differ', () => {
    const schema = new TaskFunctionStaticSchema()
    schema.validate([
      { name: DEFAULT_TASK_NAME },
      { name: 'factorial', priority: 1 },
    ])

    expect(() =>
      schema.validate([
        { name: DEFAULT_TASK_NAME },
        { name: 'factorial', priority: 2 },
      ])
    ).toThrow('Worker static task function schema is inconsistent')
  })
})
