# General guidelines

Performance is one of the main target of these worker pool implementations, poolifier team wants to have a strong focus on this.  
Poolifier already has [benchmarks](./../benchmarks/README.md) where you can find some comparisons.

## Table of contents

- [Internal Node.js thread pool](#internal-nodejs-thread-pool)
- [Cluster vs Threads worker pools](#cluster-vs-threads-worker-pools)
- [Fixed vs Dynamic pools](#fixed-vs-dynamic-pools)

## Internal Node.js thread pool

Before to jump into each poolifier pool type, let highlight that **Node.js comes with a thread pool already**, the libuv thread pool where some particular tasks already run by default.  
Please take a look at [which tasks run on the libuv thread pool](https://nodejs.org/en/docs/guides/dont-block-the-event-loop/#what-code-runs-on-the-worker-pool).

**If your task runs on libuv thread pool**, you can try to:

- Tune the libuv thread pool size setting the [UV_THREADPOOL_SIZE](https://nodejs.org/api/cli.html#cli_uv_threadpool_size_size).

and/or

- Use poolifier cluster pools that are spawning child processes, they will also increase the number of libuv threads since that any new child process comes with a separated libuv thread pool. **More threads does not mean more fast, so please tune your application**.

## Cluster vs Threads worker pools

**If your task does not run into libuv thread pool** and is CPU intensive then poolifier **thread pools** (_FixedThreadPool_ and _DynamicThreadPool_) are suggested to run CPU intensive tasks, you can still run I/O intensive tasks into thread pools, but performance enhancement is expected to be minimal.  
Thread pools are built on top of Node.js [worker_threads](https://nodejs.org/api/worker_threads.html) module.

**If your task does not run into libuv thread pool** and is I/O intensive then poolifier **cluster pools** (_FixedClusterPool_ and _DynamicClusterPool_) are suggested to run I/O intensive tasks, again you can still run CPU intensive tasks into cluster pools, but performance enhancement is expected to be minimal.  
Consider that by default Node.js already has great performance for I/O tasks (asynchronous I/O).  
Cluster pools are built on top of Node.js [cluster](https://nodejs.org/api/cluster.html) module.

If your task contains code that runs on libuv plus code that is CPU intensive or I/O intensive you either split it either combine more strategies (i.e. tune the number of libuv threads and use cluster/thread pools).  
But in general, **always profile your application**.

## Fixed vs Dynamic pools

To choose your pool consider first that with a _FixedThreadPool_/_FixedClusterPool_ or a _DynamicThreadPool_/_DynamicClusterPool_ your application memory footprint will increase.  
By doing so, your application will be ready to execute in parallel more tasks, but during idle time your application will consume more memory.  
One good choice from poolifier team point of view is to profile your application using a fixed or dynamic worker pool, and analyze your application metrics when you increase/decrease the number of workers.  
For example you could keep the memory footprint low by choosing a _DynamicThreadPool_/_DynamicClusterPool_ with a minimum of 5 workers, and allowing it to create new workers until a maximum of 50 workers if needed. This is the advantage of using a _DynamicThreadPool_/_DynamicClusterPool_.  
But in general, **always profile your application**.
