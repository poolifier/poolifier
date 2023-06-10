# Worker choice strategies

## Strategies

### Fair share

Its goal is to distribute the load evenly across all workers. To achieve this, the strategy keeps track of the average task execution time for each worker and assigns the next task to the worker with the lowest task end prediction time: `task_end_prediction = max(current_time, task_end_prediction) + average_task_execution_time`.  
By default, the strategy uses the average task execution time for each worker but it can be configured to use the event loop utilization (ELU) active time instead.

### Weighted round robin

The strategy assigns the next task using a robin round algorithm. The worker weights are maximum tasks execution time, once the worker has reached its maximum tasks execution time, the next task is assigned to the next worker.

### Interleaved weighted round robin

## Statistics

Worker choice strategies enable only the statistics that are needed to choose the next worker to avoid unnecessary overhead.

### Median

Strategies using the average task execution time for each worker can use the median instead. Median is more robust to outliers and can be used to avoid assigning tasks to workers that are currently overloaded. Median usage introduces a small overhead: measurement history must be kept for each worker and the median must be recomputed each time a new task has finished.
