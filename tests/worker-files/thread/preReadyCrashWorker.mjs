/*
 * Test fixture: pre-ready (startup) crash.
 *
 * The synchronous module-top throw fires BEFORE ThreadWorker can send
 * its 'ready' IPC, so the parent pool receives an 'exit' event while
 * `info.ready === false`.
 *
 * No worker instance is exported — Node's worker_threads runtime
 * surfaces the throw as an 'error' / 'exit' on the parent.
 */
throw new Error('startup crash')
