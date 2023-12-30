import { ThreadWorker } from 'poolifier'
import { createTransport } from 'nodemailer'
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
          workerData!.mail
        )
      }
    })
  }
}

export const smtpClientWorker = new SmtpClientWorker()
