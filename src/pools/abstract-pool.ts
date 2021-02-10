export interface PoolOptions<Worker> {
  /**
   * A function that will listen for error event on each worker.
   */
  errorHandler?: (this: Worker, e: Error) => void
  /**
   * A function that will listen for online event on each worker.
   */
  onlineHandler?: (this: Worker) => void
  /**
   * A function that will listen for exit event on each worker.
   */
  exitHandler?: (this: Worker, code: number) => void
  /**
   * This is just to avoid not useful warnings message, is used to set `maxListeners` on event emitters (workers are event emitters).
   *
   * @default 1000
   */
  maxTasks?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class AbstractPool<Worker, Data = any, Response = any> {
  public readonly workers: Worker[] = []
  public nextWorker: number = 0

  /**
   * `workerId` as key and an integer value
   */
  public readonly tasks: Map<Worker, number> = new Map<Worker, number>()

  protected id: number = 0

  public constructor (
    isMain: boolean,
    setupHook: (filePath: string) => void = () => {},
    public readonly numWorkers: number,
    public readonly filePath: string,
    public readonly opts: PoolOptions<Worker> = { maxTasks: 1000 }
  ) {
    if (!isMain) {
      throw new Error('Cannot start a pool from a worker!')
    }
    // TODO christopher 2021-02-07: Improve this check e.g. with a pattern or blank check
    if (!this.filePath) {
      throw new Error('Please specify a file with a worker implementation')
    }

    setupHook(this.filePath)

    for (let i = 1; i <= this.numWorkers; i++) {
      this.newWorker()
    }
  }

  public abstract destroy (): void

  public abstract execute (data: Data): Promise<Response>

  protected abstract internalExecute (
    worker: Worker,
    id: number
  ): Promise<Response>

  protected chooseWorker (): Worker {
    if (this.workers.length - 1 === this.nextWorker) {
      this.nextWorker = 0
      return this.workers[this.nextWorker]
    } else {
      this.nextWorker++
      return this.workers[this.nextWorker]
    }
  }

  protected abstract newWorker (): Worker
}
