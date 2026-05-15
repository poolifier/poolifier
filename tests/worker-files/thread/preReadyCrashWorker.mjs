/*
 * Test fixture for T3b (pre-ready crash) F4 regression coverage.
 *
 * The synchronous module-top throw fires BEFORE ThreadWorker can send
 * its 'ready' IPC, so the parent pool receives an 'exit' event while
 * `info.ready === false`.
 *
 * No worker instance is exported — Node's worker_threads runtime
 * surfaces the throw as an 'error' / 'exit' on the parent. Test code
 * may need to gate this scenario behind `it.skip` if its race window
 * is flaky on slow runners (documented in plan §11 Lessons learned).
 */
throw new Error('startup crash')
