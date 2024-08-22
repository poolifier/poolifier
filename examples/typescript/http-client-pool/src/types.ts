import type { AxiosRequestConfig } from 'axios'
import type { URL } from 'node:url'
import type {
  RequestInfo as NodeFetchRequestInfo,
  RequestInit as NodeFetchRequestInit,
} from 'node-fetch'

export interface WorkerData {
  axiosRequestConfig?: AxiosRequestConfig
  init?: NodeFetchRequestInit | RequestInit
  input: NodeFetchRequestInfo | RequestInfo | URL
}

export interface WorkerResponse {
  text: string
}
