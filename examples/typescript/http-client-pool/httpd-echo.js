import { Server } from 'node:http'

const port = 8080
const server = new Server()

server
  .on('request', (request, response) => {
    let body = []
    request
      .on('data', chunk => {
        body.push(chunk)
      })
      .on('end', () => {
        body = Buffer.concat(body).toString()

        console.info(`==== ${request.method} ${request.url} ====`)
        console.info('> Headers')
        console.info(request.headers)

        console.info('> Body')
        console.info(body)
        response.end()
      })
  })
  .listen(port)
