import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'

import { smtpClientPool } from './pool.js'

const tos = ['bar@example.com, baz@example.com']

const smtpClientPoolPromises = new Set<Promise<SMTPTransport.SentMessageInfo>>()
for (const to of tos) {
  smtpClientPoolPromises.add(
    smtpClientPool.execute({
      smtpTransport: {
        host: 'smtp.domain.tld',
        port: 465,
        secure: true,
        auth: {
          user: 'REPLACE-WITH-YOUR-ALIAS@DOMAIN.TLD',
          pass: 'REPLACE-WITH-YOUR-GENERATED-PASSWORD',
        },
      },
      mail: {
        from: '"Foo" <foo@domain.tld>',
        to,
        subject: 'Hello',
        text: 'Hello world?',
        html: '<b>Hello world?</b>',
      },
    })
  )
}
try {
  const now = performance.now()
  await Promise.all(smtpClientPoolPromises)
  const elapsedTime = performance.now() - now
  console.info(
    `Send in parallel in ${elapsedTime.toFixed(2)}ms ${
      tos.length
    } mails with SMTP client pool`
  )
} catch (error) {
  console.error(error)
}
