import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().min(1).default('postgres://openpte:openpte@localhost:5432/openpte'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  /** Comma-separated origins allowed to call the API from a browser, or * for any. */
  CORS_ORIGIN: z.string().default('*'),
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
  CONTENT_ROOT: z.string().default(new URL('../../../', import.meta.url).pathname),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return Env.parse(env);
}
