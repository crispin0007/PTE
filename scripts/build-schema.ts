// Writes JSON Schema files to schema/ so editors (e.g. VS Code with the YAML extension) can autocomplete
// question files. Generated from the Zod schemas, which stay the single source of truth.
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { QUESTION_SCHEMAS } from '@openpte/schema';
import { Registry } from '@openpte/schema';

mkdirSync('schema', { recursive: true });
const write = (name: string, schema: z.ZodType) =>
  writeFileSync(
    `schema/${name}.json`,
    JSON.stringify(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), null, 2) + '\n',
  );

write('item-types', Registry);
for (const [type, schema] of Object.entries(QUESTION_SCHEMAS)) write(type, schema);
console.log(`Wrote ${Object.keys(QUESTION_SCHEMAS).length + 1} schema files to schema/`);
