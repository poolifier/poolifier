# [API](https://poolifier.github.io/poolifier/)

## Table of contents

- [Pool](#pool)
  - [`pool = new FixedThreadPool/FixedClusterPool(numberOfThreads/numberOfWorkers, filePath, opts)`](#pool--new-fixedthreadpoolfixedclusterpoolnumberofthreadsnumberofworkers-filepath-opts)
  - [`pool = new DynamicThreadPool/DynamicClusterPool(min, max, filePath, opts)`](#pool--new-dynamicthreadpooldynamicclusterpoolmin-max-filepath-opts)
  - [`pool.execute(data, name, transferList)`](#poolexecutedata-name-transferlist)
  - [`pool.mapExecute(data, name, transferList)`](#poolmapexecutedata-name-transferlist)
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

### `pool.execute(data, name, transferList)`

`data` (optional) An object that you want to pass to your worker task function implementation.  
`name` (optional) A string with the task function name that you want to execute on the worker. Default: `'default'`  
`transferList` (optional) An array of transferable objects that you want to transfer to your [`ThreadWorker`](#class-yourworker-extends-threadworkerclusterworker) worker implementation.

This method is available on both pool implementations and returns a promise with the task function execution response.

### `pool.mapExecute(data, name, transferList)`

`data` Iterable objects that you want to pass to your worker task function implementation.  
`name` (optional) A string with the task function name that you want to execute on the worker. Default: `'default'`  
`transferList` (optional) An array of transferable objects that you want to transfer to your [`ThreadWorker`](#class-yourworker-extends-threadworkerclusterworker) worker implementation.

This method is available on both pool implementations and returns a promise with the task function execution responses array.

### `pool.start()`

This method is available on both pool implementations and will start the minimum number of workers.

### `pool.destroy()`

This method is available on both pool implementations and will call the terminate method on each worker.

### `pool.hasTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean.

### `pool.addTaskFunction(name, fn)`

`name` (mandatory) The task function name.  
`fn` (mandatory) The task function `(data?: Data) => Response | Promise<Response>` or task function object `{ taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy }`. Priority range is the same as Unix nice levels.

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
- `exitHandler` (optional) - A function that will listen for exit event on each worker.  
  Default: `() => {}`

- `workerChoiceStrategy` (optional) - The default worker choice strategy to use in this pool:

  - `WorkerChoiceStrategies.ROUND_ROBIN`: Submit tasks to worker in a round robin fashion
  - `WorkerChoiceStrategies.LEAST_USED`: Submit tasks to the worker with the minimum number of executing and queued tasks
  - `WorkerChoiceStrategies.LEAST_BUSY`: Submit tasks to the worker with the minimum tasks execution time
  - `WorkerChoiceStrategies.LEAST_ELU`: Submit tasks to the worker with the minimum event loop utilization (ELU)
  - `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`: Submit tasks to worker by using a [weighted round robin scheduling algorithm](./worker-choice-strategies.md#weighted-round-robin) based on tasks execution time
  - `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN`: Submit tasks to worker by using an [interleaved weighted round robin scheduling algorithm](./worker-choice-strategies.md#interleaved-weighted-round-robin-experimental) based on tasks execution time (experimental)
  - `WorkerChoiceStrategies.FAIR_SHARE`: Submit tasks to worker by using a [fair share scheduling algorithm](./worker-choice-strategies.md#fair-share) based on tasks execution time (the default) or ELU active time

  `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`, `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN` and `WorkerChoiceStrategies.FAIR_SHARE` strategies are targeted to heavy and long tasks.  
  Default: `WorkerChoiceStrategies.ROUND_ROBIN`

- `workerChoiceStrategyOptions` (optional) - The worker choice strategy options object to use in this pool.  
  Properties:

  - `measurement` (optional) - The measurement to use in worker choice strategies: `runTime`, `waitTime` or `elu`.
  - `runTime` (optional) - Use the tasks [simple moving median](./worker-choice-strategies.md#simple-moving-median) runtime instead of the tasks simple moving average runtime in worker choice strategies.
  - `waitTime` (optional) - Use the tasks [simple moving median](./worker-choice-strategies.md#simple-moving-median) wait time instead of the tasks simple moving average wait time in worker choice strategies.
  - `elu` (optional) - Use the tasks [simple moving median](./worker-choice-strategies.md#simple-moving-median) ELU instead of the tasks simple moving average ELU in worker choice strategies.
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

  Default: `{ size: (pool maximum size)^2, concurrency: 1, taskStealing: true, tasksStealingOnBackPressure: false, tasksStealingRatio: 0.6, tasksFinishedTimeout: 2000 }`

- `workerOptions` (optional) - An object with the worker options to pass to worker. See [worker_threads](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options) for more details.

- `env` (optional) - An object with the environment variables to pass to worker. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_fork_env) for more details.

- `settings` (optional) - An object with the cluster settings. See [cluster](https://nodejs.org/api/cluster.html#cluster_cluster_settings) for more details.

## Worker

### `class YourWorker extends ThreadWorker/ClusterWorker`

`taskFunctions` (mandatory) The task function or task functions object `Record<string, (data?: Data) => Response | Promise<Response> | { taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy }>` that you want to execute on the worker. Priority range is the same as Unix nice levels.  
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
`fn` (mandatory) The task function `(data?: Data) => Response | Promise<Response>` or task function object `{ taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy }`. Priority range is the same as Unix nice levels.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.removeTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.

#### `YourWorker.listTaskFunctionsProperties()`

This method is available on both worker implementations and returns an array of the task function properties.

#### `YourWorker.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns `{ status: boolean, error?: Error }`.
