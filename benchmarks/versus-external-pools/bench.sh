export NODE_ENV=production

# Execute bench
# export POOL_SIZE=8
# export NUM_ITERATIONS=10000
# hyperfine --export-markdown BENCH-10000.MD --min-runs 10 \
#   'node dynamic-poolifier.js' \
#   'node dynamic-suchmokuo-node-worker-threads-pool.js' \
#   'node fixed-poolifier.js' \
#   'node static-suchmokuo-node-worker-threads-pool.js' \
#   'node piscina.js'

# echo "Sleeping...."
# sleep 60

export POOL_SIZE=10
export NUM_ITERATIONS=100000
hyperfine --export-markdown BENCH-100000.MD --min-runs 10 \
  'node static-suchmokuo-node-worker-threads-pool.js' \
  'node dynamic-poolifier.js' \
  'node piscina.js'

# export POOL_SIZE=8
# export NUM_ITERATIONS=50000
# hyperfine --export-markdown BENCH-50000.MD --min-runs 10 \
#   'node dynamic-poolifier.js' \
#   'node dynamic-suchmokuo-node-worker-threads-pool.js' \
#   'node fixed-poolifier.js' \
#   'node static-suchmokuo-node-worker-threads-pool.js' \
#   'node piscina.js'

# export NUM_ITERATIONS=100000
#   hyperfine --export-markdown BENCH-50000.MD --min-runs 20 \
#     'node dynamic-poolifier.js' \
#     'node static-suchmokuo-node-worker-threads-pool.js' \
#     'node piscina.js'

