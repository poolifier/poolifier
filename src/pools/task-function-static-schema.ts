import type { TaskFunctionProperties } from '../utility-types.js'

import { DEFAULT_TASK_NAME } from '../utils.js'

export class TaskFunctionStaticSchema {
  public get defaultName (): string | undefined {
    return this.#properties?.[1]?.name
  }

  #properties?: readonly TaskFunctionProperties[]

  public has (name: string): boolean {
    return (
      this.#properties?.some(properties => properties.name === name) === true
    )
  }

  public validate (
    properties: readonly TaskFunctionProperties[] | undefined
  ): readonly TaskFunctionProperties[] {
    if (properties == null || properties.length < 2) {
      throw new TypeError('Worker static task function schema is missing')
    }
    if (
      properties[0]?.name !== DEFAULT_TASK_NAME ||
      properties[1]?.name === DEFAULT_TASK_NAME
    ) {
      throw new TypeError('Worker static task function default is invalid')
    }
    if (this.#properties == null) {
      this.#properties = Object.freeze(
        properties.map(property => ({
          ...property,
          ...(property.workerNodeKeys != null && {
            workerNodeKeys: [...property.workerNodeKeys],
          }),
        }))
      )
      return this.#properties
    }
    if (JSON.stringify(this.#properties) !== JSON.stringify(properties)) {
      throw new Error('Worker static task function schema is inconsistent')
    }
    return this.#properties
  }
}
