#!/usr/bin/env bash

usage() {
    echo "Usage: $0 [-s <pool size> -i <number of iterations> -t <CPU_INTENSIVE|IO_INTENSIVE>] [-n <number of tasks>]" 1>&2
    exit 1
}

while getopts "s:i:t:n:h" option
do
  case "${option}" in
    s)
      poolSize=${OPTARG}
      ;;
    i)
      iterations=${OPTARG}
      ;;
    t)
      taskType=${OPTARG}
      ;;
    n)
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

taskType=${taskType:-'CPU_INTENSIVE'}
taskSize=${taskSize:-5000}
poolSize=${poolSize:-$(nproc --all)}
numIterations=${iterations:-100000}

echo 'Running benchmarks with pool size:' ${poolSize}', number of iterations:' ${numIterations}', task type:' ${taskType} 'and task size:' ${taskSize}
export NODE_ENV=production
export TASK_TYPE=${taskType}
export TASK_SIZE=${taskSize}
export POOL_SIZE=${poolSize}
export NUM_ITERATIONS=${numIterations}
case "$OSTYPE" in
  darwin*)
    caffeinate ./hyperfine_benchmarks.sh
    ;;
  linux*)
    systemd-inhibit --what=idle ./hyperfine_benchmarks.sh
    ;;
  *)
    echo "Unsupported $OSTYPE"
    ;;
esac
