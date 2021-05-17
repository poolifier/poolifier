#!/usr/bin/env bash

### The -t argument is needed to specify the type of task that you want to benchmark.
### Supported values are CPU_INTENSIVE

taskType='CPU_INTENSIVE'
while getopts t: flag
do
  case "${flag}" in
    t)
      taskType=${OPTARG}
      ;;
  esac
done

echo 'Running bench for task type:' $taskType
export TASK_TYPE=$taskType
# Execute bench
export NODE_ENV=production
export POOL_SIZE=10
export NUM_ITERATIONS=100000
case "$OSTYPE" in
  darwin*)
    caffeinate ./hyperfine_benchmarks.sh
    ;;
  linux*)
    systemd-inhibit ./hyperfine_benchmarks.sh
    ;;
  *)
    echo "Unsupported $OSTYPE"
    ;;
esac
