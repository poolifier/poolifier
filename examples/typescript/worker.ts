import { ThreadWorker } from 'poolifier'

export interface MyData {
  ok: number
}

export interface MyResponse {
  message: string
  data: MyData
}

class MyThreadWorker extends ThreadWorker<MyData, Promise<MyResponse>> {
  constructor () {
    super(data => this.process(data), {
      maxInactiveTime: 60_000,
      async: true
    })
  }

  private async process (data: MyData): Promise<MyResponse> {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ message: 'Hello from Worker :)', data })
      }, 10_000)
    })
  }
}

export default new MyThreadWorker()
