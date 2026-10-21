import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins/magic-link';
import { schema, type Db } from './db/index.ts';
import type { Mailer } from './mail.ts';

export type AuthOptions = {
  db: Db;
  /** Public URL of this API, e.g. https://api.openpte.org */
  baseURL: string;
  secret: string;
  mailer: Mailer;
  /** Web app origins allowed to call auth and to be redirected to after sign-in. */
  trustedOrigins: string[];
  google?: { clientId: string; clientSecret: string };
  /** People who become admins when they first sign in (ADMIN_EMAILS). */
  adminEmails?: string[];
};

/**
 * Sign-in by email link or Google. No passwords: nothing to leak or reset. New users are learners;
 * teacher and admin roles are granted by an admin (step 1.10 and Phase 3).
 */
export function createAuth(o: AuthOptions) {
  return betterAuth({
    baseURL: o.baseURL,
    basePath: '/api/auth',
    secret: o.secret,
    trustedOrigins: o.trustedOrigins,
    database: drizzleAdapter(o.db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'learner', input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({
            data: {
              ...u,
              role: o.adminEmails?.includes(u.email.toLowerCase()) ? 'admin' : 'learner',
            },
          }),
        },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    socialProviders: o.google ? { google: o.google } : {},
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        sendMagicLink: async ({ email, url }) => {
          await o.mailer.send({
            to: email,
            subject: 'Your openpte sign-in link',
            text: `Open this link to sign in to openpte:\n\n${url}\n\nIt works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
          });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
