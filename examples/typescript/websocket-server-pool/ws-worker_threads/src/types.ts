export enum MessageType {
  echo = 'echo',
  factorial = 'factorial',
}

export interface MessagePayload<T = unknown> {
  data: T
  type: MessageType
}

export interface DataPayload {
  number?: number
}

export interface WorkerData<T = unknown> {
  data: T
}

export interface WorkerResponse<T = unknown> {
  data: T
}
