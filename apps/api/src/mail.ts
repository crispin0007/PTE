import nodemailer from 'nodemailer';

export type Mail = { to: string; subject: string; text: string };
export type Mailer = { send: (mail: Mail) => Promise<void> };

/** Development mailer: prints the message, so sign-in links appear in the API log. */
export const consoleMailer: Mailer = {
  async send(mail) {
    console.log(`\n--- email to ${mail.to}: ${mail.subject}\n${mail.text}\n---\n`);
  },
};

/** Any SMTP provider, e.g. smtps://user:pass@smtp.example.com:465 */
export function smtpMailer(url: string, from: string): Mailer {
  const transport = nodemailer.createTransport(url);
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}
