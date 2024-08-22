import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'

import { smtpClientPool } from './pool.js'

const tos = ['bar@example.com, baz@example.com']

const smtpClientPoolPromises = new Set<Promise<SMTPTransport.SentMessageInfo>>()
for (const to of tos) {
  smtpClientPoolPromises.add(
    smtpClientPool.execute({
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
  )
}
try {
  const now = performance.now()
  await Promise.all(smtpClientPoolPromises)
  const elapsedTime = performance.now() - now
  console.info(
    `Send in parallel in ${elapsedTime.toFixed(
      2
    )}ms ${tos.length.toString()} mails with SMTP client pool`
  )
} catch (error) {
  console.error(error)
}
