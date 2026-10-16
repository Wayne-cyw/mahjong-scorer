// Fails when a server-only secret could reach the browser (ADR-57). Run after `pnpm build`.
//  1. No NEXT_PUBLIC_* variable name looks like a secret, other than the allowlisted ones.
//  2. No file the browser can download contains an Anthropic key pattern or this build's key value.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC_DIRS = ['.next/static', 'public'];
const SECRETISH = /KEY|SECRET|TOKEN|PASSWORD/;
// Public by design: PostHog project keys and Sentry DSNs ship to the browser.
const ALLOWED_PUBLIC = new Set(['NEXT_PUBLIC_POSTHOG_KEY']);
const KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]{20,}/;
const SERVER_ONLY = ['ANTHROPIC_API_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'SENTRY_AUTH_TOKEN'];

const problems = [];

for (const name of Object.keys(process.env)) {
  if (name.startsWith('NEXT_PUBLIC_') && SECRETISH.test(name) && !ALLOWED_PUBLIC.has(name)) {
    problems.push(`${name} is exposed to the browser but its name looks like a secret`);
  }
}

const values = SERVER_ONLY.map((n) => [n, process.env[n]]).filter(([, v]) => v && v.length >= 16);

const walk = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
};

for (const file of PUBLIC_DIRS.flatMap(walk)) {
  const text = readFileSync(file, 'latin1');
  if (KEY_PATTERN.test(text)) problems.push(`${file} contains an Anthropic key pattern`);
  for (const [name, value] of values) {
    if (text.includes(value)) problems.push(`${file} contains the value of ${name}`);
  }
}

if (problems.length > 0) {
  console.error(problems.map((p) => `- ${p}`).join('\n'));
  process.exit(1);
}
console.log('check-public-bundle: ok');
