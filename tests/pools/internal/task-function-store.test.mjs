import { describe, expect, it } from 'vitest'

import { TaskFunctionStore } from '../../../lib/pools/task-function-store.mjs'

const echo = value => value

describe('TaskFunctionStore', () => {
  it('reads committed functions and projects their protocol metadata', () => {
    const taskFunction = {
      priority: -1,
      strategy: 'LEAST_USED',
      taskFunction: echo,
      workerNodeKeys: [1, 3],
    }
    const store = new TaskFunctionStore(() => ({
      defaultName: 'default',
      entries: [{ name: 'echo', taskFunction }],
      revision: 1,
    }))

    expect(store.get('echo')).toBe(taskFunction)
    expect(store.propertiesOf('echo')).toStrictEqual({
      name: 'echo',
      priority: -1,
      strategy: 'LEAST_USED',
      workerNodeKeys: [1, 3],
    })
    expect(store.hasRegistered('echo')).toBe(true)
  })

  it('uses the first populated worker projection and resolves the default alias', () => {
    const store = new TaskFunctionStore(() => ({
      defaultName: 'echo',
      entries: [],
      revision: 1,
    }))
    const properties = [
      [],
      [
        { name: 'default' },
        {
          name: 'echo',
          priority: 2,
          strategy: 'FAIR_SHARE',
          workerNodeKeys: [0, 2],
        },
      ],
      [{ name: 'ignored', priority: 9 }],
    ]

    expect(store.listProperties(properties)).toStrictEqual([
      {
        name: 'default',
        priority: 2,
        strategy: 'FAIR_SHARE',
        workerNodeKeys: [0, 2],
      },
      {
        name: 'echo',
        priority: 2,
        strategy: 'FAIR_SHARE',
        workerNodeKeys: [0, 2],
      },
    ])
    expect(store.has('echo', properties)).toBe(true)
    expect(store.priority(undefined, properties)).toBe(2)
    expect(store.strategy('default', properties)).toBe('FAIR_SHARE')
    expect(store.workerNodeKeys(undefined, properties)).toStrictEqual(
      new Set([0, 2])
    )
  })

  it('projects queue priority and all configured strategies', () => {
    const store = new TaskFunctionStore(() => ({
      defaultName: 'default',
      entries: [],
      revision: 0,
    }))
    const properties = [
      [
        { name: 'default' },
        { name: 'other', strategy: 'LEAST_BUSY' },
        { name: 'echo', priority: 0, strategy: 'ROUND_ROBIN' },
      ],
    ]

    expect(store.usesPriority(properties)).toBe(true)
    expect(
      store.workerChoiceStrategies('FAIR_SHARE', properties)
    ).toStrictEqual(new Set(['FAIR_SHARE', 'LEAST_BUSY', 'ROUND_ROBIN']))
  })
})
