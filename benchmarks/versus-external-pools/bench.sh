#!/usr/bin/env bash

### The -t argument permit to specify the type of task that you want to benchmark.
### The -s argument permit to specify the size of task that you want to benchmark.
### Supported values are CPU_INTENSIVE, IO_INTENSIVE

taskType='CPU_INTENSIVE'
taskSize=5000
while getopts "t:s:h" option
do
  case "${option}" in
    t)
      taskType=${OPTARG}
      ;;
    s)
      taskSize=${OPTARG}
      ;;
    *|h)
      echo "Usage: $0 [-t taskType] [-s taskSize]"
      exit 1
      ;;
  esac
done

echo 'Running benchmarks for task type:' ${taskType} 'and task size:' ${taskSize}
export TASK_TYPE=${taskType}
export TASK_SIZE=${taskSize}
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
