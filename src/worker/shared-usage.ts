/**
 * Shared object for workers tasks usage statistics.
 */
export class SharedUsage {
  private readonly dataView: DataView;
  [key: string]: any

  /**
   * Create a shared object for workers tasks usage statistics.
   *
   * @param numberOfWorkers Number of workers.
   * @param sharedUsageArrayBuffer Shared array buffer to use to store workers tasks usage statistics.
   */
  constructor (
    private readonly numberOfWorkers: number,
    sharedUsageArrayBuffer: SharedArrayBuffer
  ) {
    if (Number.isSafeInteger(numberOfWorkers) === false) {
      throw new TypeError('numberOfWorkers must be an integer')
    }
    if (sharedUsageArrayBuffer instanceof SharedArrayBuffer === false) {
      throw new TypeError(
        'sharedUsageArrayBuffer must be an instance of SharedArrayBuffer'
      )
    }
    this.dataView = new DataView(sharedUsageArrayBuffer)
    for (
      let i = 0, startOffset = 0;
      i < this.numberOfWorkers;
      i++,
        startOffset +=
          3 * Int32Array.BYTES_PER_ELEMENT + Float64Array.BYTES_PER_ELEMENT
    ) {
      Object.defineProperty(this, `worker${i}-run`, {
        /**
         * Set worker `workerId` number of tasks run.
         *
         * @param value Number of tasks run.
         */
        set (value: number) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          this.dataView.setInt32(startOffset, value)
        },
        /**
         * Get worker `workerId` number of tasks run.
         *
         * @returns Number of tasks run.
         */
        get (): number {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return this.dataView.getInt32(startOffset) as number
        },
        configurable: true
      })
      Object.defineProperty(this, `worker${i}-running`, {
        /**
         * Set worker `workerId` number of tasks running.
         *
         * @param value Number of tasks running.
         */
        set (value: number) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          this.dataView.setInt32(
            startOffset + Int32Array.BYTES_PER_ELEMENT,
            value
          )
        },
        /**
         * Get worker `workerId` number of tasks running.
         *
         * @returns Number of tasks running.
         */
        get (): number {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return this.dataView.getInt32(
            startOffset + Int32Array.BYTES_PER_ELEMENT
          ) as number
        },
        configurable: true
      })
      Object.defineProperty(this, `worker${i}-runTime`, {
        /**
         * Set worker `workerId` tasks run time.
         *
         * @param value Tasks run time.
         */
        set (value: number) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          this.dataView.setInt32(
            startOffset + 2 * Int32Array.BYTES_PER_ELEMENT,
            value
          )
        },
        /**
         * Get worker `workerId` tasks run time.
         *
         * @returns Tasks run time.
         */
        get (): number {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return this.dataView.getInt32(
            startOffset + 2 * Int32Array.BYTES_PER_ELEMENT
          ) as number
        },
        configurable: true
      })
      Object.defineProperty(this, `worker${i}-avgRunTime`, {
        /**
         * Set worker `workerId` tasks average run time.
         *
         * @param value Average tasks run time.
         */
        set (value: number) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          this.dataView.setFloat64(
            startOffset + 3 * Int32Array.BYTES_PER_ELEMENT,
            value
          )
        },
        /**
         * Get worker `workerId` average tasks run time.
         *
         * @returns Average tasks run time.
         */
        get (): number {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return this.dataView.getFloat64(
            startOffset + 3 * Int32Array.BYTES_PER_ELEMENT
          ) as number
        },
        configurable: true
      })
      this[`worker${i}-run`] = 0
      this[`worker${i}-running`] = 0
      this[`worker${i}-runTime`] = 0
      this[`worker${i}-avgRunTime`] = 0
    }
  }

  /**
   * Dump shared object content for debugging purpose.
   */
  public consoleDump (): void {
    for (let i = 0; i < this.numberOfWorkers; i++) {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      console.debug(`worker${i}-run: ` + this[`worker${i}-run`])
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      console.debug(`worker${i}-running: ` + this[`worker${i}-running`])
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      console.debug(`worker${i}-runTime: ` + this[`worker${i}-runTime`])
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      console.debug(`worker${i}-avgRunTime: ` + this[`worker${i}-avgRunTime`])
    }
  }
}
