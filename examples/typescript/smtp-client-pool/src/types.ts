import type Mail from 'nodemailer/lib/mailer/index.js'
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js'

export interface WorkerData {
  smtpTransport: SMTPTransport.Options
  mail: Mail.Options
}
