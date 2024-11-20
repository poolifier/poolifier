import { type RawData, WebSocketServer } from 'ws'

import { requestHandlerPool } from './pool.js'
import { type DataPayload, type MessagePayload, MessageType } from './types.js'

const port = 8080
const wss = new WebSocketServer({ port }, () => {
  console.info(
    `⚡️[ws server]: WebSocket server is started at ws://localhost:${port.toString()}/`
  )
})

const emptyFunction = (): void => {
  /* Intentional */
}

wss.on('connection', ws => {
  ws.on('error', console.error)
  ws.on('message', (message: RawData) => {
    const { data, type } = JSON.parse(

      message.toString()
    ) as MessagePayload<DataPayload>
    switch (type) {
      case MessageType.echo:
        requestHandlerPool
          .execute({ data }, 'echo')
          .then(response => {
            ws.send(
              JSON.stringify({
                data: response.data,
                type: MessageType.echo,
              })
            )
            return undefined
          })
          .catch(emptyFunction)
        break
      case MessageType.factorial:
        requestHandlerPool
          .execute({ data }, 'factorial')
          .then(response => {
            ws.send(
              JSON.stringify(
                {
                  data: response.data,
                  type: MessageType.factorial,
                },
                (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)
              )
            )
            return undefined
          })
          .catch(emptyFunction)
        break
    }
  })
})
