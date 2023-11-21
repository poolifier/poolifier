# Worker choice strategies

All duration or timestamp are expressed in milliseconds.

## Table of contents

- [Strategies](#strategies)
  - [Fair share](#fair-share)
  - [Weighted round robin](#weighted-round-robin)
  - [Interleaved weighted round robin (experimental)](#interleaved-weighted-round-robin-experimental)
- [Statistics](#statistics)
  - [Simple moving median](#simple-moving-median)

## Strategies

### Fair share

Its goal is to distribute the load evenly across all workers. To achieve this, the strategy keeps track of the simple moving average task execution time for each worker and assigns the next task to the worker with the lowest task end prediction time: `task_end_prediction = max(current_time, task_end_prediction) + simple_moving_average_task_execution_time`.  
By default, the strategy uses the simple moving average task execution time for each worker but it can be configured to use the simple moving average task event loop utilization (ELU) active time instead.

### Weighted round robin

The worker weights are maximum tasks execution time. Once the worker has reached its maximum tasks execution time, the next task is assigned to the next worker. The default worker weight is the same for each and computed given the CPU cores speed and theirs numbers.

### Interleaved weighted round robin (experimental)

The worker weights are maximum tasks execution time. The rounds are the deduplicated worker weights in descending order.  
During a round, if the worker weight is superior or equal to the current round weight and its tasks execution time is inferior to the current round weight, the task is assigned to the worker. Once all workers weight have been tested, the next round starts.  
The default worker weights is the same for each and computed given the CPU cores speed and theirs numbers. So the default 'rounds' consists of a unique worker weight.

## Statistics

Worker choice strategies enable only the statistics that are needed to choose the next worker to avoid unnecessary overhead.

### Simple moving median

Strategies using the simple moving average task execution time for each worker can use the simple moving median instead. Simple moving median is more robust to outliers and can be used to avoid assigning tasks to workers that are currently overloaded.
