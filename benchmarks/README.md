# Poolifier Benchmarks

Welcome to poolifier benchmarks and thanks to look into this project.

## Folder Structure

The internal folder contains poolifier internal benchmarks.  
The versus-external-pools folder contains benchmarks versus other Node.js pools.

## Poolifier vs other pools benchmark

To compare poolifier pools performance vs other pools performance we chose to use [hyperfine](https://github.com/sharkdp/hyperfine).  
We chose to use this tool because it allows to run isolated Node.js processes so that each pool does not impact each other.  
External pools with which we compared the poolifier results:

- [piscina](https://github.com/piscinajs/piscina)
- [SUCHMOKUO/node-worker-threads-pool](https://github.com/SUCHMOKUO/node-worker-threads-pool)
- [threads.js](https://github.com/andywer/threads.js/)
- [workerpool](https://github.com/josdejong/workerpool)
- [threadwork](https://github.com/kevlened/threadwork)
- [microjob](https://github.com/wilk/microjob)
- [worker-threads-pool](https://github.com/watson/worker-threads-pool)

Those are our results:

- CPU Intensive task with 100k operations submitted to each pool [BENCH-100000.md](./versus-external-pools/BENCH-100000.md).  
  This benchmark ran on a MacBook Pro 2015, 2,2 GHz Intel Core i7 quad-core, 16 GB 1600 MHz DDR3.

> :warning: **We would need funds to run our benchmarks more often and on Cloud VMs, please consider to sponsor this project**

## How to run benchmarks

### Internal

To run the internal benchmark you just need to navigate to the root of poolifier project and run `npm run benchmark`

## Versus other pools

To run the benchmark versus other pools you will need to:

- [Install hyperfine](https://github.com/sharkdp/hyperfine#installation)
- Run the `./bench.sh` into the `versus-external-pools` folder

> :warning: **Please be sure to use a quite PC when you run the benchmarks**
