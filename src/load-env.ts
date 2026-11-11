// src/load-env.ts
//
// Local development reads its settings from the repository's .env file.
// Nothing loaded that file before: the API depends on neither dotenv nor
// @nestjs/config, so `npm run start:dev` only worked when the shell had
// exported every variable itself, and otherwise stopped at
// getJwtSecret() (auth.module.ts reads JWT_SECRET while the module is
// imported). This is imported FIRST in main.ts so the values are present
// before any module reads process.env.
//
// A variable already set in the environment always wins: on Render the
// settings come from the dashboard and there is no .env file, so this does
// nothing there. Node's own parser (util.parseEnv, Node >= 20.12) keeps the
// file's quoting and comment rules; no dependency is added.
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parseEnv } from 'util';

const envPath = resolve(process.cwd(), '.env');

if (existsSync(envPath)) {
  const values = parseEnv(readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
