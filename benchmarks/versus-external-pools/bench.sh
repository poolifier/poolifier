### The -t argument is needed to specify the type of task that you want to benchmark.
### Supported values are CPU_INTENSIVE

taskType='CPU_INTENSIVE'
while getopts t: flag
do
    case "${flag}" in
        t) taskType=${OPTARG};;
    esac
done

echo 'Running bench for task type:' $taskType
export TASK_TYPE=$taskType
# Execute bench
export NODE_ENV=production
export POOL_SIZE=10
export NUM_ITERATIONS=100000
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
  'node fixed-microjob.js' \
  'node fixed-worker-threads-pool.js'
