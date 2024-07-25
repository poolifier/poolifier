import {
  availableParallelism,
  ClusterWorker,
  DynamicThreadPool,
} from 'poolifier'
import { type RawData, WebSocketServer } from 'ws'

import {
  type ClusterWorkerData,
  type ClusterWorkerResponse,
  type DataPayload,
  type MessagePayload,
  MessageType,
  type ThreadWorkerData,
  type ThreadWorkerResponse,
} from './types.js'

const emptyFunction = (): void => {
  /* Intentional */
}

class WebSocketServerWorker extends ClusterWorker<
  ClusterWorkerData,
  ClusterWorkerResponse
> {
  private static wss: WebSocketServer
  private static requestHandlerPool: DynamicThreadPool<
    ThreadWorkerData<DataPayload>,
    ThreadWorkerResponse<DataPayload>
  >

  private static readonly startWebSocketServer = (
    workerData?: ClusterWorkerData
  ): ClusterWorkerResponse => {
    const { port, workerFile, minWorkers, maxWorkers, ...poolOptions } =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      workerData!

    WebSocketServerWorker.requestHandlerPool = new DynamicThreadPool<
      ThreadWorkerData<DataPayload>,
      ThreadWorkerResponse<DataPayload>
    >(
      minWorkers ?? 1,
      maxWorkers ?? availableParallelism(),
      workerFile,
      poolOptions
    )

    WebSocketServerWorker.wss = new WebSocketServer({ port }, () => {
      console.info(
        `⚡️[ws server]: WebSocket server is started in cluster worker at ws://localhost:${port.toString()}/`
      )
    })

    WebSocketServerWorker.wss.on('connection', ws => {
      ws.on('error', console.error)
      ws.on('message', (message: RawData) => {
        const { type, data } = JSON.parse(

          message.toString()
        ) as MessagePayload<DataPayload>
        switch (type) {
          case MessageType.echo:
            WebSocketServerWorker.requestHandlerPool
              .execute({ data }, 'echo')
              .then(response => {
                ws.send(
                  JSON.stringify({
                    type: MessageType.echo,
                    data: response.data,
                  })
                )
                return undefined
              })
              .catch(emptyFunction)
            break
          case MessageType.factorial:
            WebSocketServerWorker.requestHandlerPool
              .execute({ data }, 'factorial')
              .then(response => {
                ws.send(
                  JSON.stringify(
                    {
                      type: MessageType.factorial,
                      data: response.data,
                    },
                    (_, v: unknown) =>
                      typeof v === 'bigint' ? v.toString() : v
                  )
                )
                return undefined
              })
              .catch(emptyFunction)
            break
        }
      })
    })
    return {
      status: true,
      port: WebSocketServerWorker.wss.options.port,
    }
  }

  public constructor () {
    super(WebSocketServerWorker.startWebSocketServer, {
      killHandler: async () => {
        await WebSocketServerWorker.requestHandlerPool.destroy()
        WebSocketServerWorker.wss.close()
      },
    })
  }
}

export const webSocketServerWorker = new WebSocketServerWorker()
