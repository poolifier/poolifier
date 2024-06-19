import type { URL } from 'node:url'

import type { AxiosRequestConfig } from 'axios'
import type {
  RequestInfo as NodeFetchRequestInfo,
  RequestInit as NodeFetchRequestInit,
} from 'node-fetch'

export interface WorkerData {
  input: URL | RequestInfo | NodeFetchRequestInfo
  init?: RequestInit | NodeFetchRequestInit
  axiosRequestConfig?: AxiosRequestConfig
}

export interface WorkerResponse {
  text: string
}
