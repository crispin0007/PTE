import type { GrammarIssue } from '@openpte/scoring';
import type { FastifyInstance } from 'fastify';

/** Talks to a LanguageTool server (self-hosted; see docker-compose.yml). */
export type GrammarClient = { check: (text: string) => Promise<GrammarIssue[]> };

export const MAX_GRAMMAR_CHARS = 6000;

type LtMatch = {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; category: { id: string } };
};

/** Spelling is scored separately (Hunspell), so LanguageTool's spelling matches are left out. */
const isSpelling = (m: LtMatch) =>
  m.rule.category.id === 'TYPOS' || m.rule.id.startsWith('MORFOLOGIK_RULE');

export function httpLanguageTool(url: string, language = 'en-US'): GrammarClient {
  return {
    async check(text) {
      const res = await fetch(`${url.replace(/\/$/, '')}/v2/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, language }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`LanguageTool returned ${res.status}`);
      const { matches } = (await res.json()) as { matches: LtMatch[] };
      return matches
        .filter((m) => !isSpelling(m))
        .map((m) => ({
          offset: m.offset,
          length: m.length,
          message: m.message,
          replacements: m.replacements.slice(0, 3).map((r) => r.value),
          category: m.rule.category.id,
        }));
    },
  };
}

/**
 * POST /v1/writing/check: grammar issues for a Writing answer. Open to guests like the rest of
 * practice, with a per-address hourly limit so the checker cannot be used as a free proxy.
 */
export function grammarRoutes(grammar: GrammarClient, perHour = 120) {
  const seen = new Map<string, { n: number; since: number }>();
  return async (app: FastifyInstance) => {
    app.post<{ Body: { text?: string } }>('/v1/writing/check', async (req, reply) => {
      const text = req.body?.text ?? '';
      if (typeof text !== 'string' || !text.trim())
        return reply.code(400).send({ error: 'text is required' });
      if (text.length > MAX_GRAMMAR_CHARS)
        return reply.code(413).send({ error: `at most ${MAX_GRAMMAR_CHARS} characters` });
      const now = Date.now();
      const hit = seen.get(req.ip);
      const window = hit && now - hit.since < 3_600_000 ? hit : { n: 0, since: now };
      if (window.n >= perHour)
        return reply.code(429).send({ error: 'too many checks; try again in an hour' });
      seen.set(req.ip, { ...window, n: window.n + 1 });
      try {
        return { issues: await grammar.check(text) };
      } catch (e) {
        req.log.warn({ err: e }, 'grammar check failed');
        return reply.code(503).send({ error: 'the grammar checker is not available right now' });
      }
    });
  };
}
