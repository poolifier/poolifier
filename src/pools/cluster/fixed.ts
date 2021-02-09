import { SendHandle } from 'child_process';
import * as cluster from 'cluster';
import { Worker } from 'cluster';

function empty(): void {
    // empty
}

export type Draft<T> = { -readonly [P in keyof T]?: T[P] };

export type WorkerWithMessageChannel = Worker; // & Draft<MessageChannel>;

export interface FixedClusterPoolOptions {
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
export class FixedClusterPool<Data = any, Response = any> {
    public readonly workers: WorkerWithMessageChannel[] = [];
    public nextWorker: number = 0;

    // threadId as key and an integer value
    public readonly tasks: Map<WorkerWithMessageChannel, number> = new Map<WorkerWithMessageChannel, number>();

    protected _id: number = 0;

    /**
     * @param numThreads Num of threads for this worker pool.
     * @param filePath A file path with implementation of `ThreadWorker` class, relative path is fine.
     * @param opts An object with possible options for example `errorHandler`, `onlineHandler`. Default: `{ maxTasks: 1000 }`
     */
    public constructor(
        public readonly numThreads: number,
        public readonly filePath: string,
        public readonly opts: FixedClusterPoolOptions = { maxTasks: 1000 }
    ) {
        if (!cluster.isMaster) throw new Error('Cannot start a cluster pool from a worker!');
        if (!this.filePath) throw new Error('Please specify a file with a worker implementation');

        cluster.setupMaster({
            exec: this.filePath,
        });

        for (let i: number = 1; i <= this.numThreads; i++) {
            this._newWorker();
        }
    }

    public destroy(): void {
        for (const worker of this.workers) {
            worker.kill();
        }
    }

    /**
     * Execute the task specified into the constructor with the data parameter.
     *
     * @param data The input for the task specified.
     * @returns Promise that is resolved when the task is done.
     */
    public async execute(data: Data): Promise<Response> {
        // configure worker to handle message with the specified task
        const worker: WorkerWithMessageChannel = this._chooseWorker();
        // console.log('FixedClusterPool#execute choosen worker:', worker);
        this.tasks.set(worker, this.tasks.get(worker) + 1);
        const id: number = ++this._id;
        const res: Promise<Response> = this._execute(worker, id);
        // console.log('FixedClusterPool#execute send data to worker:', worker);
        worker.send({ data: data || {}, _id: id });
        return res;
    }

    protected _execute(worker: WorkerWithMessageChannel, id: number): Promise<Response> {
        return new Promise((resolve, reject) => {
            const listener: (message: any, handle: SendHandle) => void = (message) => {
                // console.log('FixedClusterPool#_execute listener:', message);
                if (message._id === id) {
                    worker.removeListener('message', listener);
                    this.tasks.set(worker, this.tasks.get(worker) - 1);
                    if (message.error) reject(message.error);
                    else resolve(message.data);
                }
            };
            worker.on('message', listener);
        });
    }

    protected _chooseWorker(): WorkerWithMessageChannel {
        if (this.workers.length - 1 === this.nextWorker) {
            this.nextWorker = 0;
            return this.workers[this.nextWorker];
        } else {
            this.nextWorker++;
            return this.workers[this.nextWorker];
        }
    }

    protected _newWorker(): WorkerWithMessageChannel {
        const worker: WorkerWithMessageChannel = cluster.fork();
        worker.on('error', this.opts.errorHandler || empty);
        worker.on('online', this.opts.onlineHandler || empty);
        // TODO handle properly when a thread exit
        worker.on('exit', this.opts.exitHandler || empty);
        this.workers.push(worker);
        // const { port1, port2 } = new MessageChannel();
        // worker.send({ parent: port1 }, [port1]);
        // worker.port1 = port1;
        // worker.port2 = port2;
        // we will attach a listener for every task,
        // when task is completed the listener will be removed but to avoid warnings we are increasing the max listeners size
        // worker.port2.setMaxListeners(this.opts.maxTasks || 1000);
        worker.setMaxListeners(this.opts.maxTasks || 1000);
        // init tasks map
        this.tasks.set(worker, 0);
        return worker;
    }
}
