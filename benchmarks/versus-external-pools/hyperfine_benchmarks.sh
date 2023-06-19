#!/usr/bin/env bash

hyperfine --export-markdown BENCH-100000.md --min-runs 20 --prepare 'sleep 10' --warmup 10 \
  'node dynamic-poolifier.js' \
  'node fixed-poolifier.js' \
  'node dynamic-piscina.js' \
  'node fixed-piscina.js' \
  'node fixed-tinypool.mjs' \
  'node dynamic-tinypool.mjs' \
  'node dynamic-workerpool.js' \
  'node fixed-workerpool.js' \
  'node dynamic-suchmokuo-node-worker-threads-pool.js' \
  'node static-suchmokuo-node-worker-threads-pool.js' \
  'node threadjs.js' \
  'node fixed-threadwork.js' \
  'node fixed-microjob.js' \
  # Seems to have scalability issues, disabled for now
  # 'node dynamic-worker-nodes.js' \
  # 'node fixed-worker-nodes.js'
