import { ThreadWorker } from 'poolifier'
import { createTransport } from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer/index.js'
import { type WorkerData } from './types.js'

class SmtpClientWorker extends ThreadWorker<WorkerData> {
  public constructor () {
    super({
      nodemailer: async (workerData?: WorkerData) => {
        await createTransport(workerData?.smtpTransport).sendMail(
          workerData?.mail as Mail.Options
        )
      }
    })
  }
}

export const smtpClientWorker = new SmtpClientWorker()
