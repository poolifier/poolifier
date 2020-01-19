# Node Pool :arrow_double_up: :on:
[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)
[![Dependabot](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)](https://badgen.net/dependabot/dependabot/dependabot-core/?icon=dependabot)
[![Actions Status](https://github.com/pioardi/node-pool/workflows/NodeCI/badge.svg)](https://github.com/pioardi/node-pool/actions)

Node pool contains two <a href="https://nodejs.org/api/worker_threads.html#worker_threads_worker_threads">worker-threads </a> pool implementations. <br>
The first implementation is a static thread pool , with a defined number of threads that are started at creation time .<br>
The second implementation is a dynamic thread pool with a number of threads started at creation time and other threads created when the load will increase ( with an upper limit ). <br>

