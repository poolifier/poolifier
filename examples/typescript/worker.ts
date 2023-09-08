import { ThreadWorker } from 'poolifier'

export interface MyData {
  ok: 0 | 1
}

export interface MyResponse {
  message: string
  data: MyData
}

class MyThreadWorker extends ThreadWorker<MyData, Promise<MyResponse>> {
  constructor () {
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    super((data: MyData) => this.process(data), {
      maxInactiveTime: 60000
    })
  }

  private async process (data: MyData): Promise<MyResponse> {
    return await new Promise(resolve => {
      setTimeout(() => {
        resolve({ message: 'Hello from Worker :)', data })
      }, 10000)
    })
  }
}

export default new MyThreadWorker()
