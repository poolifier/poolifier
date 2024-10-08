import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'

import { createTransport } from 'nodemailer'
import { ThreadWorker } from 'poolifier'

import type { WorkerData } from './types.js'

class SmtpClientWorker extends ThreadWorker<
  WorkerData,
  SMTPTransport.SentMessageInfo
> {
  public constructor () {
    super({
      nodemailer: async (workerData?: WorkerData) => {
        return await createTransport(workerData?.smtpTransport).sendMail(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          workerData!.mail
        )
      },
    })
  }
}

export const smtpClientWorker = new SmtpClientWorker()
