import { inArray } from 'drizzle-orm';
import { loadContent } from '@openpte/schema/node';
import { buildApp } from './app.ts';
import { createAuth } from './auth.ts';
import { loadConfig } from './config.ts';
import { schema } from './db/index.ts';
import { connect } from './db/postgres.ts';
import { consoleMailer, smtpMailer } from './mail.ts';
import { purgeExpired } from './recordings.ts';
import { seed } from './seed.ts';
import { httpSpeech } from './speech.ts';
import { diskStorage } from './storage.ts';

const config = loadConfig();
const { db, close } = await connect(config.DATABASE_URL);
if (config.SEED_ON_START) {
  const result = await seed(db, loadContent(config.CONTENT_ROOT));
  console.log(`seeded ${result.questions} questions across ${result.itemTypes} types`);
}
if (config.ADMIN_EMAILS.length) {
  await db
    .update(schema.user)
    .set({ role: 'admin' })
    .where(inArray(schema.user.email, config.ADMIN_EMAILS));
}
const origins = config.CORS_ORIGIN.split(',').map((o) => o.trim());
const google =
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
    ? { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET }
    : undefined;
const auth =
  config.CORS_ORIGIN === '*'
    ? undefined
    : createAuth({
        db,
        baseURL: config.PUBLIC_API_URL,
        secret: config.BETTER_AUTH_SECRET,
        mailer: config.SMTP_URL ? smtpMailer(config.SMTP_URL, config.MAIL_FROM) : consoleMailer,
        trustedOrigins: origins,
        google,
        adminEmails: config.ADMIN_EMAILS,
      });
const storage = diskStorage(config.RECORDINGS_DIR);
const purge = () =>
  purgeExpired(db, storage).then(
    (n) => n && console.log(`deleted ${n} expired recordings`),
    (e: Error) => console.error(`purging recordings failed: ${e.message}`),
  );
await purge();
setInterval(() => void purge(), 60 * 60 * 1000).unref();
const app = await buildApp({
  db,
  includeUnreviewed: config.INCLUDE_UNREVIEWED,
  corsOrigin: config.CORS_ORIGIN,
  logger: true,
  auth,
  googleEnabled: !!google,
  storage,
  scoring: config.SPEECH_URL
    ? {
        speech: httpSpeech(config.SPEECH_URL, config.SPEECH_TOKEN),
        dailyLimit: config.SPEECH_DAILY_LIMIT,
      }
    : undefined,
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(close)
      .then(() => process.exit(0));
  });
}
await app.listen({ port: config.PORT, host: config.HOST });
