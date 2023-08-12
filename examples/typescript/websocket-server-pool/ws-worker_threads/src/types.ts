export enum MessageType {
  echo = 'echo',
  factorial = 'factorial'
}

export interface MessagePayload<T = unknown> {
  type: MessageType
  data: T
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
