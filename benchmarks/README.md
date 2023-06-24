# Poolifier Benchmarks

Welcome to poolifier benchmarks and thanks to look into this project.

## Folder Structure

The [internal](./internal) folder contains poolifier internal benchmarks.  
The [versus-external-pools](./versus-external-pools) folder contains benchmarks versus other Node.js pools.

## Poolifier vs other pools benchmark

To compare poolifier pools performance vs other pools performance we chose to use [hyperfine](https://github.com/sharkdp/hyperfine).  
We chose to use this tool because it allows to run isolated Node.js processes so each pool does not impact each other.  
External pools with which we compared the poolifier results:

- [piscina](https://github.com/piscinajs/piscina)
- [tinypool](https://github.com/tinylibs/tinypool)
- [node-worker-threads-pool](https://github.com/SUCHMOKUO/node-worker-threads-pool)
- [workerpool](https://github.com/josdejong/workerpool)
- [worker-nodes](https://github.com/allegro/node-worker-nodes)
- [threads.js](https://github.com/andywer/threads.js/)
- [threadwork](https://github.com/kevlened/threadwork)
- [microjob](https://github.com/wilk/microjob)

Those are our results:

- CPU Intensive task with 100k operations submitted to each pool [BENCH-100000.md](./versus-external-pools/BENCH-100000.md).

> :warning: **We would need funds to run our benchmarks more often and on Cloud VMs, please consider to sponsor this project**

## How to run benchmarks

### Internal

To run the internal benchmarks, you just need to navigate to the root of poolifier project and run `pnpm benchmark`

## Versus other pools

Read [README.md](./versus-external-pools/README.md)
