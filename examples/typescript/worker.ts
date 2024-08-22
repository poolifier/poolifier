import { ThreadWorker } from 'poolifier'

export interface MyData {
  ok: 0 | 1
}

export interface MyResponse {
  data?: MyData
  message: string
}

class MyThreadWorker extends ThreadWorker<MyData, MyResponse> {
  constructor () {
    super(async (data?: MyData) => await this.process(data), {
      maxInactiveTime: 60000,
    })
  }

  private async process (data?: MyData): Promise<MyResponse> {
    return await new Promise(resolve => {
      setTimeout(() => {
        resolve({ data, message: 'Hello from Worker :)' })
      }, 1000)
    })
  }
}

export default new MyThreadWorker()
