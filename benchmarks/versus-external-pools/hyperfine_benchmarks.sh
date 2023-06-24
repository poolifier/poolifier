#!/usr/bin/env bash

hyperfine --export-markdown BENCH-100000.md --min-runs 20 --prepare 'sleep 2' --warmup 2 \
  'node dynamic-poolifier.js' \
  'node fixed-poolifier.js' \
  'node dynamic-piscina.js' \
  'node fixed-piscina.js' \
  'node fixed-tinypool.mjs' \
  'node dynamic-tinypool.mjs' \
  'node dynamic-workerpool.js' \
  'node fixed-workerpool.js' \
  'node dynamic-node-worker-threads-pool.js' \
  'node static-node-worker-threads-pool.js' \
  'node threadjs.js' \
  'node fixed-threadwork.js' \
  'node fixed-microjob.js' \
  'node dynamic-worker-nodes.js' \
  'node fixed-worker-nodes.js'
