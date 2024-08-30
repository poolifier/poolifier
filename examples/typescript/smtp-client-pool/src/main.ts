import type { WorkerData } from './types.js'

import { smtpClientPool } from './pool.js'

const tos = ['bar@example.com, baz@example.com']

const smtpMessages = new Set<WorkerData>()
for (const to of tos) {
  smtpMessages.add({
    mail: {
      from: '"Foo" <foo@domain.tld>',
      html: '<b>Hello world?</b>',
      subject: 'Hello',
      text: 'Hello world?',
      to,
    },
    smtpTransport: {
      auth: {
        pass: 'REPLACE-WITH-YOUR-GENERATED-PASSWORD',
        user: 'REPLACE-WITH-YOUR-ALIAS@DOMAIN.TLD',
      },
      host: 'smtp.domain.tld',
      port: 465,
      secure: true,
    },
  })
}

try {
  const now = performance.now()
  await smtpClientPool.mapExecute(smtpMessages)
  const elapsedTime = performance.now() - now
  console.info(
    `Send in parallel in ${elapsedTime.toFixed(
      2
    )}ms ${tos.length.toString()} mails with SMTP client pool`
  )
} catch (error) {
  console.error(error)
}
