// T3c: synchronous throw fires before ThreadWorker sends 'ready' IPC.
// No worker exported — Node surfaces the throw as 'error'/'exit'.
throw new Error('startup crash')
