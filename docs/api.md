# API

## Table of contents

- [Pool](#pool)
  - [`pool = new FixedThreadPool/FixedClusterPool(numberOfThreads/numberOfWorkers, filePath, opts)`](#pool--new-fixedthreadpoolfixedclusterpoolnumberofthreadsnumberofworkers-filepath-opts)
  - [`pool = new DynamicThreadPool/DynamicClusterPool(min, max, filePath, opts)`](#pool--new-dynamicthreadpooldynamicclusterpoolmin-max-filepath-opts)
  - [`pool.execute(data, name, abortSignal, transferList)`](#poolexecutedata-name-abortsignal-transferlist)
  - [`pool.mapExecute(data, name, abortSignals, transferList)`](#poolmapexecutedata-name-abortsignals-transferlist)
  - [`pool.start()`](#poolstart)
  - [`pool.destroy()`](#pooldestroy)
  - [Worker crash and termination contracts](#worker-crash-and-termination-contracts)
  - [`pool.hasTaskFunction(name)`](#poolhastaskfunctionname)
  - [`pool.addTaskFunction(name, fn)`](#pooladdtaskfunctionname-fn)
  - [`pool.removeTaskFunction(name)`](#poolremovetaskfunctionname)
  - [`pool.listTaskFunctionsProperties()`](#poollisttaskfunctionsproperties)
  - [`pool.setDefaultTaskFunction(name)`](#poolsetdefaulttaskfunctionname)
  - [Pool options](#pool-options)
- [Major release breaking changes](#major-release-breaking-changes)
- [Worker](#worker)
  - [`class YourWorker extends ThreadWorker/ClusterWorker`](#class-yourworker-extends-threadworkerclusterworker)
    - [`YourWorker.hasTaskFunction(name)`](#yourworkerhastaskfunctionname)
    - [`YourWorker.addTaskFunction(name, fn)`](#yourworkeraddtaskfunctionname-fn)
    - [`YourWorker.removeTaskFunction(name)`](#yourworkerremovetaskfunctionname)
    - [`YourWorker.listTaskFunctionsProperties()`](#yourworkerlisttaskfunctionsproperties)
    - [`YourWorker.setDefaultTaskFunction(name)`](#yourworkersetdefaulttaskfunctionname)

## Pool

### `pool = new FixedThreadPool/FixedClusterPool(numberOfThreads/numberOfWorkers, filePath, opts)`

`numberOfThreads/numberOfWorkers` (mandatory) Number of workers for this pool.  
`filePath` (mandatory) Path to a file with a worker implementation.  
`opts` (optional) An object with the pool options properties described below.

### `pool = new DynamicThreadPool/DynamicClusterPool(min, max, filePath, opts)`

`min` (mandatory) Same as _FixedThreadPool_/_FixedClusterPool_ numberOfThreads/numberOfWorkers, this number of workers will be always active.  
`max` (mandatory) Max number of workers that this pool can contain, the newly created workers will die after a threshold (default is 1 minute, you can override it in your worker implementation).  
`filePath` (mandatory) Path to a file with a worker implementation.  
`opts` (optional) An object with the pool options properties described below.

### `pool.execute(data, name, abortSignal, transferList)`

`data` (optional) An object that you want to pass to your worker task function implementation.  
`name` (optional) A string with the task function name that you want to execute on the worker. Default: `'default'`  
`abortSignal` (optional) An abort signal to abort the task function execution.  
`transferList` (optional) An array of transferable objects that you want to transfer to your [`ThreadWorker`](#class-yourworker-extends-threadworkerclusterworker) worker implementation.

This method is available on both pool implementations and returns a promise with the task function execution response.

### `pool.mapExecute(data, name, abortSignals, transferList)`

`data` An iterable of objects that you want to pass to your worker task function implementation.  
`name` (optional) A string with the task function name that you want to execute on the worker. Default: `'default'`  
`abortSignals` (optional) An iterable of AbortSignal to abort the matching object task function execution.  
`transferList` (optional) An array of transferable objects that you want to transfer to your [`ThreadWorker`](#class-yourworker-extends-threadworkerclusterworker) worker implementation.

This method is available on both pool implementations and returns a promise with the task function execution responses array.

### `pool.start()`

This method is available on both pool implementations and synchronously starts the minimum number of workers. The pool accepts tasks only after every minimum worker has been registered. If startup fails, every worker created by that attempt is removed from scheduling, the original thrown value is preserved, and the pool can be started again.

Calling `start()` while the pool is starting, running, or being destroyed throws.

### `pool.destroy()`

This method is available on both pool implementations and terminates every worker. Destruction stops new task submission immediately. Calls that overlap the same destruction return the same promise and therefore share its fulfillment or rejection. A call made after destruction has completed returns a rejected promise. A successfully destroyed pool can subsequently be restarted with `start()`.

When `pool.destroy()` begins, the pool stops accepting new work. Full-pool destruction does not redistribute queued tasks to other workers. Queued tasks still assigned to workers reject with `WorkerTerminationError`. Destroying one worker outside full-pool destruction first redistributes its queued tasks to ready peer workers. A queued task that cannot be redistributed rejects with `WorkerTerminationError`.

Termination waits up to `tasksFinishedTimeout` for in-flight tasks. A task that settles before the timeout keeps its normal outcome. An in-flight task still pending at the timeout rejects with `WorkerTerminationError`. If a worker emits an error or exits abnormally while it is draining, every still-owned in-flight and queued task rejects with its own `WorkerCrashError`. An exit caused by the physical termination invoked by Poolifier remains pool-initiated and uses `WorkerTerminationError`.

Idle workers terminated by the pool do not emit `PoolEvents.error`. Dynamic workers terminated by hard idle eviction while a task is still in-flight reject that task with `WorkerTerminationError`.

### Worker crash and termination contracts

Every task promise affected by a worker crash or pool-initiated termination settles. The error classes are exported from `poolifier`:

- `WorkerCrashError` reports an unexpected worker exit. Its `name` is the non-writable string `WorkerCrashError`. `workerId` identifies the runtime worker, `taskId` identifies the rejected task, `exitCode` is the raw nullable exit code, `signal` is the raw nullable exit signal, and `cause` contains the original error when Node.js supplies one.
- `WorkerTerminationError` reports pool-initiated termination before a task could settle. Its `name` is the non-writable string `WorkerTerminationError`. Pool-generated errors carry the rejected task's `taskId` and runtime `workerId`; they do not attach raw worker termination failures as `cause`. A `cause` remains available when explicitly supplied during direct construction. Raw worker termination failures surface separately through the `PoolEvents.error` listener.

Use `error.name` to discriminate these errors when code can receive both the CommonJS and ESM package builds. An object created by one build is not an `instanceof` the class from the other build.

An exit is abnormal when the worker emits an error, exits with a nonzero code, exits because of a signal, or exits with code `0` while it still owns an in-flight task. All in-flight tasks assigned to that worker reject with `WorkerCrashError`. Queued tasks are redistributed to ready peer workers when possible; any queued task that cannot be redistributed also rejects with `WorkerCrashError`.

For cluster workers, `exitCode` and `signal` preserve Node.js exit-event semantics. A signal exit has `exitCode: null` and the signal name when Node.js provides it. A normal or nonzero code exit has `signal: null`. No synthetic code or signal is substituted. An uncaught exception in a cluster worker is reported through its exit status; the original throw text remains on worker stderr and is not added to `cause`.

`restartWorkerOnError` controls replacement after an abnormal exit. When it is `true`, the pool replaces an abnormally exited worker as needed to restore its minimum size. When it is `false`, the pool does not replace that worker. A clean code `0` exit with no in-flight task is not an error and replenishes the pool minimum regardless of this option. A code `0` exit with an in-flight task is abnormal and follows the option.

`restartPolicy` bounds faulted worker replacements. More than `maxRestarts` faulted replacements within `windowTime` trip the pool into an unrecoverable state: faulted workers are no longer replaced, `PoolEvents.degraded` is emitted with a `PoolDegradedEvent`, and further `execute`/`mapExecute` submissions reject with `PoolUnrecoverableError` instead of queuing indefinitely. The unrecoverable state latches; the pool is re-armed only by restarting it with `destroy()` followed by `start()`, which clears the circuit breaker and resets the health state to healthy. Independently of the circuit breaker, the pool emits `PoolEvents.degraded` when its ready worker nodes drop below the minimum size and `PoolEvents.degradedEnd` when they recover.

For an observed crash, the `PoolEvents.error` listener receives one `WorkerCrashError` with no `taskId`; its `cause` holds the original Node.js error when Node.js supplies it. Each affected task promise receives a distinct `WorkerCrashError` with its own `taskId`. Raw crash details (`cause`, `exitCode`, `signal`) reach a task error only when the worker owns exactly one active task; otherwise the task error omits them. Each task promise settles exactly once. Recoverable queued tasks are redistributed to ready peer workers once the crashed worker's transport has drained, which may take up to the termination grace period.

The `errorHandler`, `exitHandler`, and `PoolEvents.error` callbacks are synchronous. A throw in any of them is rethrown asynchronously exactly once after task settlement and cleanup complete; it does not replace the typed task rejection.

### `pool.hasTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean.

### `pool.addTaskFunction(name, fn)`

`name` (mandatory) The task function name.  
`fn` (mandatory) The task function `(data?: Data) => Response | Promise<Response>` or task function object `{ taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }`. Priority range is the same as Unix nice levels. `workerNodeKeys` is an array of worker node keys to restrict task execution to specific workers (worker node affinity).

#### Worker Node Affinity Notes

- Worker node keys are validated at registration time against the pool's maximum size (`maximumNumberOfWorkers ?? minimumNumberOfWorkers`).
- The number of worker node keys cannot exceed the pool's maximum size (`maximumNumberOfWorkers ?? minimumNumberOfWorkers`).
- In dynamic pools, you can reference worker node keys up to the maximum pool size. Workers that don't exist yet are automatically created when a task targeting them is executed.
- At execution time, if no specified worker is ready, selection retries until one becomes available or retries are exhausted.

This method is available on both pool implementations and returns a boolean promise.

### `pool.removeTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean promise.

### `pool.listTaskFunctionsProperties()`

This method is available on both pool implementations and returns an array of the task function properties.

### `pool.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean promise.

### Pool options

An object with these properties:

- `onlineHandler` (optional) - A function that will listen for online event on each worker.  
  Default: `() => {}`
- `messageHandler` (optional) - A function that will listen for message event on each worker.  
  Default: `() => {}`
- `errorHandler` (optional) - A function that will listen for error event on each worker.  
  Default: `() => {}`
- `exitHandler` (optional) - A function that will listen for exit event on each worker. The signature is `(exitCode: number | null, signal?: NodeJS.Signals | null) => void`; thread workers provide `exitCode` and omit `signal`, while cluster workers set `exitCode` to `null` for a signal exit and provide `signal` when Node.js does.
  Default: `() => {}`

- `workerChoiceStrategy` (optional) - The default worker choice strategy to use in this pool:
  - `WorkerChoiceStrategies.ROUND_ROBIN`: Submit tasks to worker in a round robin fashion
  - `WorkerChoiceStrategies.LEAST_USED`: Submit tasks to the worker with the minimum number of executing and queued tasks
  - `WorkerChoiceStrategies.LEAST_BUSY`: Submit tasks to the worker with the minimum tasks execution time
  - `WorkerChoiceStrategies.LEAST_ELU`: Submit tasks to the worker with the minimum event loop utilization (ELU)
  - `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`: Submit tasks to worker by using a [weighted round robin scheduling algorithm](./worker-choice-strategies.md) based on tasks execution time
  - `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN`: Submit tasks to worker by using an [interleaved weighted round robin scheduling algorithm](./worker-choice-strategies.md) based on tasks execution time (experimental)
  - `WorkerChoiceStrategies.FAIR_SHARE`: Submit tasks to worker by using a [fair share scheduling algorithm](./worker-choice-strategies.md) based on tasks execution time (the default) or ELU active time

  `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`, `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN` and `WorkerChoiceStrategies.FAIR_SHARE` strategies are targeted to heavy and long tasks.  
  Default: `WorkerChoiceStrategies.LEAST_USED`

- `workerChoiceStrategyOptions` (optional) - The worker choice strategy options object to use in this pool.  
  Properties:
  - `measurement` (optional) - The measurement to use in worker choice strategies: `runTime`, `waitTime` or `elu`.
  - `runTime` (optional) - Use the tasks [simple moving median](./worker-choice-strategies.md) runtime instead of the tasks simple moving average runtime in worker choice strategies.
  - `waitTime` (optional) - Use the tasks [simple moving median](./worker-choice-strategies.md) wait time instead of the tasks simple moving average wait time in worker choice strategies.
  - `elu` (optional) - Use the tasks [simple moving median](./worker-choice-strategies.md) ELU instead of the tasks simple moving average ELU in worker choice strategies.
  - `weights` (optional) - The worker weights to use in weighted round robin worker choice strategies: `Record<number, number>`.

  Default: `{ runTime: { median: false }, waitTime: { median: false }, elu: { median: false } }`

- `startWorkers` (optional) - Start the minimum number of workers at pool initialization.  
  Default: `true`
- `restartWorkerOnError` (optional) - Restart workers after abnormal exits. A clean exit with no in-flight task replenishes the pool minimum regardless of this option. A clean exit while a task is in-flight is treated as abnormal and follows this option.
  Default: `true`
- `restartPolicy` (optional) - Bounds faulted worker replacements within a sliding time window to contain crash loops (e.g. a poison task or a leaking worker). Disabled by default. Once the bound is exceeded the pool becomes unrecoverable: it stops replacing faulted workers, emits `PoolEvents.degraded`, and `execute`/`mapExecute` reject with `PoolUnrecoverableError`.
  Properties:
  - `maxRestarts` (optional) - Maximum number of faulted worker replacements permitted within `windowTime`. It must be a safe integer in `1..1000`, or `Infinity` to disable the bound. Default: `Infinity`.
  - `windowTime` (optional) - Trailing sliding window in milliseconds over which `maxRestarts` faulted replacements are counted. It must be an integer in `1000..2_147_483_647`. Default: `60000`.
- `enableEvents` (optional) - Pool events integrated with async resource emission enablement.  
  Default: `true`
- `enableTasksQueue` (optional) - Tasks queue per worker enablement in this pool.  
  Default: `false`

- `tasksQueueOptions` (optional) - The worker tasks queue options object to use in this pool.  
  Properties:
  - `size` (optional) - The maximum number of tasks that can be queued on a worker before flagging it as back pressured. It must be a positive integer.
  - `concurrency` (optional) - The maximum number of tasks that can be executed concurrently on a worker. It must be a positive integer.
  - `taskStealing` (optional) - Task stealing enablement on idle.
  - `tasksStealingOnBackPressure` (optional) - Tasks stealing enablement under back pressure.
  - `tasksStealingRatio` (optional) - The ratio of worker nodes that can steal tasks from another worker node. It must be a number between 0 and 1.
  - `tasksFinishedTimeout` (optional) - Time in milliseconds to wait for in-flight tasks at worker termination. It must be an integer in `0..2_147_483_647`. A value of `0` applies the timeout immediately.
  - `agingFactor` (optional) - Controls the priority queue anti-starvation aging rate (priority points per millisecond). It must be a non-negative number.
  - `loadExponent` (optional) - Controls load-based aging adjustment exponent. It must be a positive number.

  Default: `{ size: (pool maximum size)^2, concurrency: 1, taskStealing: true, tasksStealingOnBackPressure: true, tasksStealingRatio: 0.6, tasksFinishedTimeout: 2000, agingFactor: 0.001, loadExponent: 0.667 }`

- `workerOptions` (optional) - An object with the worker options to pass to worker. See [worker_threads](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for more details.

- `env` (optional) - An object with the environment variables to pass to worker. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_fork_env) for more details.

- `settings` (optional) - An object with the cluster settings. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_settings) for more details.

## Major release breaking changes

- `ExitHandler` now receives `(exitCode: number | null, signal?: NodeJS.Signals | null)`. Thread workers pass the raw exit code. Cluster workers preserve the raw Node.js code and signal values.
- `PromiseResponseWrapper.workerId` replaces `PromiseResponseWrapper.workerNodeKey`. `workerId` is the stable runtime worker identity bound to the in-flight task.
- `TaskUUID`, `WorkerCrashError`, `WorkerTerminationError`, and `PoolUnrecoverableError` are public exports. Task-related error metadata uses `TaskUUID` for `taskId`.
- `restartPolicy` pool option, the `PoolEvents.degraded`/`PoolEvents.degradedEnd` events, and `PoolUnrecoverableError` add crash-loop containment: faulted worker replacements are bounded, an unrecoverable pool is signaled, and submissions to it fail fast.
- `IWorkerNode` now exposes the typed `prependOnceWorkerEventHandler` method.
- `WorkerInfo` now exposes the `crashHandled` and `terminating` lifecycle flags.

## Worker

### `class YourWorker extends ThreadWorker/ClusterWorker`

`taskFunctions` (mandatory) The task function or task functions object `Record<string, (data?: Data) => Response | Promise<Response> | { taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }>` that you want to execute on the worker. Priority range is the same as Unix nice levels. `workerNodeKeys` is an array of worker node keys to restrict task execution to specific workers (worker node affinity). See [Worker Node Affinity Notes](#worker-node-affinity-notes) above for validation behavior.  
`opts` (optional) An object with these properties:

- `killBehavior` (optional) - Dictates if your worker will be deleted in case a task is active on it.  
  **KillBehaviors.SOFT**: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but the worker is stealing tasks or a task is executing or queued, then the worker **won't** be deleted.  
  **KillBehaviors.HARD**: If `currentTime - lastActiveTime` is greater than `maxInactiveTime` but the worker is stealing tasks or a task is executing or queued, then the worker will be deleted.  
  This option only apply to the newly created workers.  
  Default: `KillBehaviors.SOFT`

- `maxInactiveTime` (optional) - Maximum waiting time in milliseconds for tasks on newly created workers. After this time newly created workers will die. It must be a positive integer greater or equal than 5.  
  The last active time of your worker will be updated when it terminates a task.  
  If `killBehavior` is set to `KillBehaviors.HARD` this value represents also the timeout for the tasks that you submit to the pool, when this timeout expires your tasks is interrupted before completion and removed. The worker is killed if is not part of the minimum size of the pool.  
  If `killBehavior` is set to `KillBehaviors.SOFT` your tasks have no timeout and your workers will not be terminated until your task is completed.  
  Default: `60000`

- `killHandler` (optional) - A function that will be called when a worker is killed.  
  Default: `() => {}`

#### `YourWorker.hasTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.addTaskFunction(name, fn)`

`name` (mandatory) The task function name.  
`fn` (mandatory) The task function `(data?: Data) => Response | Promise<Response>` or task function object `{ taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }`. Priority range is the same as Unix nice levels. `workerNodeKeys` is an array of worker node keys to restrict task execution to specific workers (worker node affinity). See [Worker Node Affinity Notes](#worker-node-affinity-notes) above for validation behavior.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.removeTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.listTaskFunctionsProperties()`

This method is available on both worker implementations and returns an array of the task function properties.

#### `YourWorker.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.
