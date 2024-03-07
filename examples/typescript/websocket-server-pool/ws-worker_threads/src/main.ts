import { type RawData, WebSocketServer } from 'ws'

import { requestHandlerPool } from './pool.js'
import { type DataPayload, type MessagePayload, MessageType } from './types.js'

const port = 8080
const wss = new WebSocketServer({ port }, () => {
  console.info(
    `⚡️[ws server]: WebSocket server is started at ws://localhost:${port}/`
  )
})

const emptyFunction = (): void => {
  /* Intentional */
}

wss.on('connection', ws => {
  ws.on('error', console.error)
  ws.on('message', (message: RawData) => {
    const { type, data } = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      message.toString()
    ) as MessagePayload<DataPayload>
    switch (type) {
      case MessageType.echo:
        requestHandlerPool
          .execute({ data }, 'echo')
          .then(response => {
            ws.send(
              JSON.stringify({
                type: MessageType.echo,
                data: response.data
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
              JSON.stringify({
                type: MessageType.factorial,
                data: response.data
              })
            )
            return undefined
          })
          .catch(emptyFunction)
        break
    }
  })
})
