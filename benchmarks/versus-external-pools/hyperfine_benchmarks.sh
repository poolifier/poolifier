#!/usr/bin/env bash

hyperfine --export-markdown BENCH-100000.md --min-runs 10 \
  --prepare 'sleep 15' \
  'node dynamic-piscina.js' \
  'node fixed-piscina.js' \
  'node dynamic-poolifier.js' \
  'node fixed-poolifier.js' \
  'node dynamic-suchmokuo-node-worker-threads-pool.js' \
  'node static-suchmokuo-node-worker-threads-pool.js' \
  'node threadjs.js' \
  'node dynamic-workerpool.js' \
  'node fixed-workerpool.js' \
  'node fixed-threadwork.js' \
  'node fixed-microjob.js'


