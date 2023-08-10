import { type URL } from 'node:url'
import { type RequestInfo, type RequestInit } from 'node-fetch'

export interface WorkerData {
  url: URL | RequestInfo
  init?: RequestInit
}

export interface WorkerResponse {
  text: string
}
