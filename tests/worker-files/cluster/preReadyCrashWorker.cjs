'use strict'
// T3c: cluster mirror of thread/preReadyCrashWorker.mjs. Synchronous
// throw fires before ClusterWorker sends 'ready' IPC.
throw new Error('startup crash')
