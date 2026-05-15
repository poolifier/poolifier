'use strict'
/*
 * Test fixture for T3b (pre-ready crash) F4 regression coverage —
 * cluster mirror of tests/worker-files/thread/preReadyCrashWorker.mjs.
 *
 * The synchronous module-top throw fires BEFORE ClusterWorker can send
 * its 'ready' IPC, so the parent pool receives an 'exit' event while
 * `info.ready === false`.
 */
throw new Error('startup crash')
