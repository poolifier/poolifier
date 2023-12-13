# Poolifier benchmarks

Welcome to poolifier benchmarks and thanks to look into this project.

## Folder Structure

The [internal](./internal) folder contains poolifier internal benchmark.

## Poolifier benchmark versus other worker pools

To compare poolifier pools performance vs other pools performance we chose to use [hyperfine](https://github.com/sharkdp/hyperfine).  
We chose to use this tool because it allows to run isolated Node.js processes so each pool does not impact each other.

- External pools with which we compare the poolifier results:

  - [piscina](https://github.com/piscinajs/piscina)
  - [tinypool](https://github.com/tinylibs/tinypool)
  - [workerpool](https://github.com/josdejong/workerpool)
  - [worker-nodes](https://github.com/allegro/node-worker-nodes)
  - [node-worker-threads-pool](https://github.com/SUCHMOKUO/node-worker-threads-pool)
  - [nanothreads](https://github.com/snuffyDev/nanothreads)

  Those are our results:

  - CPU Intensive task with 100k operations submitted to each pool: [https://bencher.dev/perf/poolifier-benchmark](https://bencher.dev/perf/poolifier-benchmark).

- External pools with which we used to compare the poolifier results:

  <!-- - [node-worker-threads-pool](https://github.com/SUCHMOKUO/node-worker-threads-pool): removed because it does not support dynamic modules import or import outside the task function. The task function is expected to be self-contained, which makes it difficult to use in real world application without ugly hacks. -->

  - [worker-threads-pool](https://github.com/watson/worker-threads-pool): removed because unmaintained since more than 4 years.
  - [threadwork](https://github.com/kevlened/threadwork): removed because unmaintained since more than 3 years.
  - [microjob](https://github.com/wilk/microjob): removed because unmaintained since more than 5 years.
  - [threads.js](https://github.com/andywer/threads.js): removed because not a threads pool.

> :warning: **We would need funds to run our benchmark more often and on Cloud VMs, please consider to sponsor this project**

Read the [README.md](https://github.com/poolifier/benchmark#readme) to know how to run the benchmark.

## Poolifier internal benchmark

### Usage

To run the internal benchmark, you just need to navigate to the root of poolifier cloned repository and run `pnpm benchmark`.

### [Results](https://bencher.dev/perf/poolifier)
