declare module "poolifier" {
  import { AsyncResource } from "async_hooks";
  import { EventEmitter } from "events";
  import { Worker } from "worker_threads";

  export interface FixedThreadPoolOptions {
    /**
     * A function that will listen for error event on each worker thread.
     */
    errorHandler?: (this: Worker, e: Error) => void;
    /**
     * A function that will listen for online event on each worker thread.
     */
    onlineHandler?: (this: Worker) => void;
    /**
     * A function that will listen for exit event on each worker thread.
     */
    exitHandler?: (this: Worker, code: number) => void;
    /**
     * This is just to avoid not useful warnings message, is used to set `maxListeners` on event emitters (workers are event emitters).
     *
     * @default 1000
     */
    maxTasks?: number;
  }

  /**
   * A thread pool with a static number of threads, is possible to execute tasks in sync or async mode as you prefer.
   *
   * This pool will select the worker thread in a round robin fashion.
   *
   * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
   * @since 0.0.1
   */
  export class FixedThreadPool<Data = any, Response = any> {
    /**
     * Num of threads for this worker pool.
     */
    numThreads: number;
    workers: Worker[];
    nextWorker: number;
    opts: FixedThreadPoolOptions;
    filePath: string;
    tasks: Map<Worker, number>;

    _id: number;

    /**
     * @param numThreads Num of threads for this worker pool.
     * @param filePath A file path with implementation of `ThreadWorker` class, relative path is fine.
     * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
     */
    constructor(
      numThreads: number,
      filePath: string,
      opts?: FixedThreadPoolOptions
    );

    destroy(): Promise<void>;

    /**
     * Execute the task specified into the constructor with the data parameter.
     *
     * @param data The input for the task specified.
     * @returns Promise that is resolved when the task is done.
     */
    execute(data: Data): Promise<Response>;

    _execute(worker: Worker, id: number): Promise<unknown>;
    _chooseWorker(): Worker;
    _newWorker(): Worker;
  }

  export type DynamicThreadPoolOptions = FixedThreadPoolOptions;

  class MyEmitter extends EventEmitter {}

  /**
   * A thread pool with a min/max number of threads, is possible to execute tasks in sync or async mode as you prefer.
   *
   * This thread pool will create new workers when the other ones are busy, until the max number of threads,
   * when the max number of threads is reached, an event will be emitted, if you want to listen this event use the emitter method.
   *
   * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
   * @since 0.0.1
   */
  export class DynamicThreadPool<
    Data = any,
    Response = any
  > extends FixedThreadPool<Data, Response> {
    max: number;
    emitter: MyEmitter;

    /**
     * @param min Min number of threads that will be always active
     * @param max Max number of threads that will be active
     * @param filename A file path with implementation of `ThreadWorker` class, relative path is fine.
     * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
     */
    constructor(
      min: number,
      max: number,
      filename: string,
      opts?: DynamicThreadPoolOptions
    );
  }

  export interface ThreadWorkerOptions {
    /**
     * Max time to wait tasks to work on (in ms), after this period the new worker threads will die.
     *
     * @default 60.000 ms
     */
    maxInactiveTime?: number;
    /**
     * `true` if your function contains async pieces, else `false`.
     *
     * @default false
     */
    async?: boolean;
  }

  /**
   * An example worker that will be always alive, you just need to **extend** this class if you want a static pool.
   *
   * When this worker is inactive for more than 1 minute, it will send this info to the main thread,
   * if you are using DynamicThreadPool, the workers created after will be killed, the min num of thread will be guaranteed.
   *
   * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
   * @since 0.0.1
   */
  export class ThreadWorker<Data = any, Response = any> extends AsyncResource {
    opts: ThreadWorkerOptions;
    maxInactiveTime: number;
    async: boolean;
    lastTask: number;
    interval: number;
    parent: Worker;

    constructor(fn: (data: Data) => Response, opts?: ThreadWorkerOptions);

    _checkAlive(): boolean;
    _run(fn: (data: Data) => Response, value: { data: Data }): void;
    _runAsync(
      fn: (data: Data) => Promise<Response>,
      value: { data: Data }
    ): void;
  }
}
