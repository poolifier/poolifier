#!/usr/bin/env bash

### The -t argument permit to specify the type of task that you want to benchmark.
### Supported values are CPU_INTENSIVE, IO_INTENSIVE
### The -s argument permit to specify the size of task that you want to benchmark.

usage() {
    echo "Usage: $0 [-t <CPU_INTENSIVE|IO_INTENSIVE>] [-s <number of tasks>]" 1>&2
    exit 1
}

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
    :)
      echo "Error: Missing option argument for '-${OPTARG}'" >&2;
      usage
      ;;
    \?)
      # Invalid option
      echo "Error: Unknown or invalid option for '-${OPTARG}'" >&2;
      usage
      ;;
    *|h)
      usage
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
