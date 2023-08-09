# Worker choice strategies

## Table of contents

- [Strategies](#strategies)
  - [Fair share](#fair-share)
  - [Weighted round robin](#weighted-round-robin)
  - [Interleaved weighted round robin](#interleaved-weighted-round-robin)
- [Statistics](#statistics)
  - [Median](#median)

## Strategies

All duration or timestamp are expressed in milliseconds.

### Fair share

Its goal is to distribute the load evenly across all workers. To achieve this, the strategy keeps track of the average task execution time for each worker and assigns the next task to the worker with the lowest task end prediction time: `task_end_prediction = max(current_time, task_end_prediction) + average_task_execution_time`.  
By default, the strategy uses the average task execution time for each worker but it can be configured to use the average task event loop utilization (ELU) active time instead.

### Weighted round robin

The worker weights are maximum tasks execution time, once the worker has reached its maximum tasks execution time, the next task is assigned to the next worker. The worker default weights are the same for all workers and is computed given the CPU cores speed and theirs numbers.

### Interleaved weighted round robin

The worker weights are maximum tasks execution time. The rounds are the deduplicated worker weights.  
During a round, if worker weight is inferior to the current round, the next task is assigned to the next worker. Once all workers have been assigned a task, the next round starts.  
The worker default weights are the same for all workers and is computed given the CPU cores speed and theirs numbers. So the default rounds consists of a unique worker weight.

## Statistics

Worker choice strategies enable only the statistics that are needed to choose the next worker to avoid unnecessary overhead.

### Median

Strategies using the average task execution time for each worker can use the median instead. Median is more robust to outliers and can be used to avoid assigning tasks to workers that are currently overloaded. Median usage introduces a small overhead: measurement history must be kept for each worker and the median must be recomputed each time a task has finished.
