import { loadContent } from '@openpte/schema/node';
import { loadConfig } from './config.ts';
import { connect } from './db/postgres.ts';
import { seed } from './seed.ts';

const config = loadConfig();
const { db, close } = await connect(config.DATABASE_URL);
const result = await seed(db, loadContent(config.CONTENT_ROOT));
console.log(`seeded ${result.questions} questions across ${result.itemTypes} types`);
await close();
