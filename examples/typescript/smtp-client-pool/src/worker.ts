import { ThreadWorker } from 'poolifier'
import { createTransport } from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer/index.js'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'
import type { WorkerData } from './types.js'

class SmtpClientWorker extends ThreadWorker<
WorkerData,
SMTPTransport.SentMessageInfo
> {
  public constructor () {
    super({
      nodemailer: async (workerData?: WorkerData) => {
        return await createTransport(workerData?.smtpTransport).sendMail(
          workerData?.mail as Mail.Options
        )
      }
    })
  }
}

export const smtpClientWorker = new SmtpClientWorker()
