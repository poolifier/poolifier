# API

## Table of contents

- [Pool](#pool)
  - [`pool = new FixedThreadPool/FixedClusterPool(numberOfThreads/numberOfWorkers, filePath, opts)`](#pool--new-fixedthreadpoolfixedclusterpoolnumberofthreadsnumberofworkers-filepath-opts)
  - [`pool = new DynamicThreadPool/DynamicClusterPool(min, max, filePath, opts)`](#pool--new-dynamicthreadpooldynamicclusterpoolmin-max-filepath-opts)
  - [`pool.execute(data, name, abortSignal, transferList)`](#poolexecutedata-name-abortsignal-transferlist)
  - [`pool.mapExecute(data, name, abortSignals, transferList)`](#poolmapexecutedata-name-abortsignals-transferlist)
  - [`pool.start()`](#poolstart)
  - [`pool.destroy()`](#pooldestroy)
  - [`pool.hasTaskFunction(name)`](#poolhastaskfunctionname)
  - [`pool.addTaskFunction(name, fn)`](#pooladdtaskfunctionname-fn)
  - [`pool.removeTaskFunction(name)`](#poolremovetaskfunctionname)
  - [`pool.listTaskFunctionsProperties()`](#poollisttaskfunctionsproperties)
  - [`pool.setDefaultTaskFunction(name)`](#poolsetdefaulttaskfunctionname)
  - [Pool options](#pool-options)
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
`transferList` (optional) An array of transferable objects that you want to transfer to your [`ThreadWorker`](#class-yourworker-extends-threadworkerclusterworker) worker implementation. The array is copied at submission.

This method is available on both pool implementations and returns a promise with the task function execution response.

Promise and thenable task results are awaited, including promises from other JavaScript realms. Functions need not be declared `async`.

An already-aborted signal rejects the task before submission.

#### Task failures

- If sending a task throws, its promise rejects with the original error, without failing other tasks.
- On unexpected worker exit, unfinished tasks already sent to it reject with an `Error` and are not retried. Thread responses sent before exit retain their result or task error; cluster responses must reach the pool before exit.
- Task errors reported by a worker reject the task promise and emit `taskError` when events are enabled. For tasks with transferred objects, the event's `data` is the original input object; reporting does not return ownership of those objects. Other task errors may omit input that cannot be copied back.
- If a worker cannot report a task error, it exits unexpectedly and unfinished tasks follow the rules above.
- Queued tasks move to ready workers allowed by worker node affinity, using current worker node indices after removal and any replacement attempt. Affinity still applies while other workers initialize. Tasks without an eligible destination reject.
- Eligible tasks are reassigned before `backPressureEnd` is emitted. Disabling task queues during reassignment sends eligible queued tasks directly instead of discarding them.
- Task cancellation preserves an `Error` reason, wraps a string reason in a new `Error`, or produces a task-specific abort `Error` otherwise.
- Worker failures emit the pool's `error` event with the original value when events are enabled. Rejections wrap non-`Error` values in an `Error` with the original value as `cause`.
- If a replacement worker cannot be created, affected task promises still settle; the creation error is not suppressed.

Intentional termination alone does not guarantee rejection of unfinished task promises. Worker errors during termination still follow the failure rules above.

### `pool.mapExecute(data, name, abortSignals, transferList)`

`data` An iterable of objects that you want to pass to your worker task function implementation.  
`name` (optional) A string with the task function name that you want to execute on the worker. Default: `'default'`  
`abortSignals` (optional) An iterable of AbortSignal matching the input order and length. One-shot iterables are supported.  
`transferList` (optional) Same as [`pool.execute()`](#poolexecutedata-name-abortsignal-transferlist), with one array snapshot for the batch.

This method is available on both pool implementations and returns a promise with the task function execution responses array.

Task failures follow the same rules as [`pool.execute()`](#task-failures).

### `pool.start()`

This method is available on both pool implementations and will start the minimum number of workers.

### `pool.destroy()`

This method is available on both pool implementations and returns a promise for pool destruction. Workers that have already exited do not block destruction.

The pool waits up to 1000 milliseconds for each worker to confirm cleanup before terminating it. Cleanup failure or timeout does not prevent termination; unfinished cleanup can be interrupted. Reported cleanup failures emit the pool's `error` event when events are enabled. This timeout does not bound total pool destruction time.

### `pool.hasTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean.

### `pool.addTaskFunction(name, fn)`

`name` (mandatory) The task function name.  
`fn` (mandatory) The task function `(data?: Data) => Response | PromiseLike<Response>` or task function object `{ taskFunction: (data?: Data) => Response | PromiseLike<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }`. Priority range is the same as Unix nice levels. `workerNodeKeys` restricts initial task dispatch to specific workers (worker node affinity).

This method is available on both pool implementations and returns a boolean promise. See [Runtime task function changes](#runtime-task-function-changes).

The function's source and options, including `workerNodeKeys`, are captured at call time. Later caller changes do not affect registration or replacement workers.

#### Worker Node Affinity Notes

- Worker node keys are validated at registration time against the pool's maximum size (`maximumNumberOfWorkers ?? minimumNumberOfWorkers`).
- The number of worker node keys cannot exceed the pool's maximum size (`maximumNumberOfWorkers ?? minimumNumberOfWorkers`).
- In dynamic pools, you can reference worker node keys up to the maximum pool size. Workers that don't exist yet are automatically created when a task targeting them is executed.
- At execution time, if no specified worker is ready, selection retries until one becomes available or retries are exhausted. Initialization failures on ineligible workers do not reject waiting tasks.
- Task stealing on idle or under back pressure ignores worker node affinity.
- With task queues enabled, disable both `taskStealing` and `tasksStealingOnBackPressure` for strict worker node affinity. Both are enabled by default.

### `pool.removeTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean promise. See [Runtime task function changes](#runtime-task-function-changes).

### `pool.listTaskFunctionsProperties()`

This method is available on both pool implementations and returns an array of the task function properties.

### `pool.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean promise. See [Runtime task function changes](#runtime-task-function-changes).

With no workers, this method resolves to `true` without changing the default selection.

### Runtime task function changes

Pool-wide calls to `addTaskFunction()`, `removeTaskFunction()` and `setDefaultTaskFunction()` run in call order. A failed call does not block later calls or undo changes already applied to workers.

If workers are present when a change starts, each must respond or exit before the call settles. At least one successful result is required; any reported failure rejects the change. Thread pools preserve operation results sent before an unexpected worker exit.

New and replacement workers wait for ongoing task function changes. They accept tasks only after restoring successfully registered task functions, the selected default and scheduling options. Workers being terminated remain unavailable.

Custom worker subclasses that defer task function operations must echo the request's `taskFunctionOperationId` in their acknowledgement, or retain the original `taskFunctionProperties` object when using the standard transport. An acknowledgement without a recoverable UUID rejects the operation. Pool-wide changes still wait for all original targets to respond or exit. Status-only overrides that discard this correlation must be updated.

### Pool options

An object with these properties:

- `onlineHandler` (optional) - A function that will listen for online event on each worker.  
  Default: `() => {}`
- `messageHandler` (optional) - A function that will listen for message event on each worker.  
  Default: `() => {}`
- `errorHandler` (optional) - A function that will listen for error event on each worker.  
  Default: `() => {}`
- `exitHandler` (optional) - A function called once per worker exit after pool cleanup, including when replacement construction fails. Receives the exit code with the native worker as `this`.  
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
- `restartWorkerOnError` (optional) - Restart worker on uncaught error in this pool.  
  Default: `true`
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
  - `tasksFinishedTimeout` (optional) - Queued tasks finished timeout in milliseconds at worker termination.
  - `agingFactor` (optional) - Controls the priority queue anti-starvation aging rate (priority points per millisecond). It must be a non-negative number.
  - `loadExponent` (optional) - Controls load-based aging adjustment exponent. It must be a positive number.

  Default: `{ size: (pool maximum size)^2, concurrency: 1, taskStealing: true, tasksStealingOnBackPressure: true, tasksStealingRatio: 0.6, tasksFinishedTimeout: 2000, agingFactor: 0.001, loadExponent: 0.667 }`

- `workerOptions` (optional) - An object with the worker options to pass to worker. See [worker_threads](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for more details.

- `env` (optional) - An object with the environment variables to pass to worker. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_fork_env) for more details.

- `settings` (optional) - An object with the cluster settings. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_settings) for more details.

## Worker

### `class YourWorker extends ThreadWorker/ClusterWorker`

`taskFunctions` (mandatory) The task function or task functions object `Record<string, (data?: Data) => Response | PromiseLike<Response> | { taskFunction: (data?: Data) => Response | PromiseLike<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }>` that you want to execute on the worker. Priority range is the same as Unix nice levels. `workerNodeKeys` restricts initial task dispatch to specific workers (worker node affinity). See [Worker Node Affinity Notes](#worker-node-affinity-notes) for affinity behavior.  
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

- `killHandler` (optional) - A cleanup function called when the pool requests worker termination. Returned promises and thenables are awaited, subject to the [`pool.destroy()` timeout and failure rules](#pooldestroy).  
  Default: `() => {}`

#### `YourWorker.hasTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.addTaskFunction(name, fn)`

`name` (mandatory) The task function name.  
`fn` (mandatory) The task function `(data?: Data) => Response | PromiseLike<Response>` or task function object `{ taskFunction: (data?: Data) => Response | PromiseLike<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }`. Priority range is the same as Unix nice levels. `workerNodeKeys` restricts initial task dispatch to specific workers (worker node affinity). See [Worker Node Affinity Notes](#worker-node-affinity-notes) for affinity behavior.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.removeTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.listTaskFunctionsProperties()`

This method is available on both worker implementations and returns an array of the task function properties.

#### `YourWorker.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.
