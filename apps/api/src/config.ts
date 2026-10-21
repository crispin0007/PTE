import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().min(1).default('postgres://openpte:openpte@localhost:5432/openpte'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  /**
   * Comma-separated web app origins allowed to call the API with cookies. * allows any origin
   * to read questions but turns accounts off, since cookies cannot be shared with every site.
   */
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://localhost:4173,http://localhost:8080'),
  /** Public URL of this API, used in sign-in links. */
  PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  /** At least 32 random characters in production: openssl rand -base64 32 */
  BETTER_AUTH_SECRET: z.string().min(32).default('dev-only-secret-change-me-in-production-0000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** SMTP URL for sign-in emails. Without it, links are printed in the API log. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('openpte <no-reply@localhost>'),
  /** Comma-separated emails that are admins (on first sign-in, and promoted on every start). */
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  /** Serve questions still in review, as the demo site does. Off in production. */
  INCLUDE_UNREVIEWED: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1'),
  /** Load content/ into the database on start. */
  SEED_ON_START: z
    .enum(['0', '1'])
    .default('1')
    .transform((v) => v === '1'),
  /** Folder for saved speaking recordings. */
  RECORDINGS_DIR: z.string().default('./data'),
  /** URL of services/speech. Without it, speaking answers are self-checked only. */
  SPEECH_URL: z.string().url().optional(),
  SPEECH_TOKEN: z.string().optional(),
  /** Server speech scores per learner per 24 hours. */
  SPEECH_DAILY_LIMIT: z.coerce.number().int().min(0).default(30),
  /** Who may create an institute: anyone signed in (hosted default) or platform admins only. */
  INSTITUTE_CREATION: z.enum(['anyone', 'admin']).default('anyone'),
  /** Set for a single-institute self-host: its name. Everyone who signs in joins it. */
  SINGLE_INSTITUTE_NAME: z.string().min(1).optional(),
  CONTENT_ROOT: z.string().default(new URL('../../../', import.meta.url).pathname),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = Env.parse(env);
  if (env.NODE_ENV === 'production' && config.BETTER_AUTH_SECRET.startsWith('dev-only'))
    throw new Error('Set BETTER_AUTH_SECRET in production (openssl rand -base64 32)');
  return config;
}
