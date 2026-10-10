import type { TaskUUID } from '../utility-types.js'

export class DuplicateTaskError extends Error {
  public override readonly name = 'DuplicateTaskError'

  public constructor (public readonly taskId: TaskUUID) {
    super(`Task already registered: '${taskId}'`)
  }
}
