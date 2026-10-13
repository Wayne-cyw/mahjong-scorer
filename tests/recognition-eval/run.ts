/**
 * Recognition evaluation (ADR-48). Runs every labelled photo through the same model call the
 * route makes and reports per-tile accuracy, zero-correction rate, latency and cost per hand.
 *
 *   pnpm eval --model claude-haiku-4-5-20251001
 *
 * See README.md for the photo folder and labels format. Photos are read locally, resized like
 * the phone does, sent to the Claude API and never written anywhere.
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import {
  groupSummaries,
  labelsSchema,
  matchTiles,
  summarize,
  type Label,
  type PhotoOutcome,
  type Prices,
  type Summary,
} from '@/lib/recognition/eval-metrics';
import { RecognizeError } from '@/lib/recognition/errors';
import { recognizeImage } from '@/lib/recognition/server/claude';

const DEFAULT_MODEL = process.env.RECOGNITION_MODEL || 'claude-haiku-4-5-20251001';
const HERE = new URL('.', import.meta.url).pathname;

/** The 1568 px / 0.85 JPEG pipeline of the phone (ADR-42), so the eval sees what the route sees. */
const prepare = async (path: string, maxEdge: number): Promise<Uint8Array> => {
  const out = await sharp(readFileSync(path))
    .rotate() // apply EXIF orientation, then metadata (including GPS) is dropped on re-encode
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return new Uint8Array(out);
};

const pct = (n: number): string => (Number.isNaN(n) ? 'n/a' : `${(n * 100).toFixed(1)}%`);
const ms = (n: number): string => (Number.isNaN(n) ? 'n/a' : `${Math.round(n)} ms`);
const usd = (n: number): string => (Number.isNaN(n) ? 'n/a' : `$${n.toFixed(4)}`);

const printSummary = (title: string, s: Summary): void => {
  console.log(`${title}`);
  console.log(`  photos              ${s.photos}`);
  console.log(`  per-tile accuracy   ${pct(s.tileAccuracy)}`);
  console.log(`  zero-correction     ${pct(s.zeroCorrectionRate)}`);
  console.log(`  latency p50 / p95   ${ms(s.latencyP50)} / ${ms(s.latencyP95)}`);
  console.log(`  cost per hand       ${usd(s.costPerHand)}`);
};

/** Stop early after this many photos in a row fail with `upstream`: that is a key, quota or outage
 * problem, not the model misreading tiles, and carrying on would only burn time and money. */
const MAX_CONSECUTIVE_UPSTREAM = 5;

const fail = (message: string): never => {
  console.error(message);
  process.exit(2);
};

const parseCli = () =>
  parseArgs({
    options: {
      model: { type: 'string', default: DEFAULT_MODEL },
      dir: { type: 'string', default: join(HERE, 'photos') },
      labels: { type: 'string' },
      'max-edge': { type: 'string', default: '1568' },
      'input-price': { type: 'string', default: '1' },
      'output-price': { type: 'string', default: '5' },
      limit: { type: 'string' },
    },
    allowPositionals: true,
  }).values;

const main = async (): Promise<void> => {
  let values: ReturnType<typeof parseCli>;
  try {
    values = parseCli();
  } catch (error) {
    return fail(`${(error as Error).message}`);
  }

  const dir = resolve(values.dir);
  const labelsPath = resolve(values.labels ?? join(dir, 'labels.json'));
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    fail(
      `No photo folder at ${dir}.\n` +
        'Create it and add labelled photos (see tests/recognition-eval/README.md), or pass --dir.',
    );
  }
  if (!existsSync(labelsPath)) {
    fail(
      `No labels file at ${labelsPath}.\n` +
        'Copy tests/recognition-eval/labels.example.json next to your photos as labels.json.',
    );
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    fail('ANTHROPIC_API_KEY is not set. Export it in this shell to run the evaluation.');
  }

  let rawLabels: unknown;
  try {
    rawLabels = JSON.parse(readFileSync(labelsPath, 'utf8'));
  } catch (error) {
    return fail(`${labelsPath} is not readable JSON: ${(error as Error).message}`);
  }
  const parsed = labelsSchema.safeParse(rawLabels);
  if (!parsed.success) {
    return fail(`labels.json is not valid:\n${parsed.error.message}`);
  }

  const positive = (flag: string, raw: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) fail(`--${flag} must be a positive number, got "${raw}".`);
    return n;
  };
  const limit = values.limit === undefined ? undefined : positive('limit', values.limit);
  const maxEdge = positive('max-edge', values['max-edge']);
  const prices: Prices = {
    input: positive('input-price', values['input-price']),
    output: positive('output-price', values['output-price']),
  };
  const labels: Label[] = limit ? parsed.data.slice(0, limit) : parsed.data;
  const model = values.model;

  const client = new Anthropic({ apiKey });
  const items: { tags: { set?: string; lighting?: string }; outcome: PhotoOutcome }[] = [];

  console.log(`Evaluating ${labels.length} photo(s) with ${model} at ${maxEdge} px\n`);
  let upstreamStreak = 0;
  let stoppedEarly = false;
  for (const [i, label] of labels.entries()) {
    const expected = matchTiles(label, label).expected;
    const tags = { set: label.set, lighting: label.lighting };
    const path = join(dir, label.file);
    const started = Date.now();
    let outcome: PhotoOutcome;
    try {
      if (!existsSync(path)) throw new Error('photo file not found');
      const bytes = await prepare(path, maxEdge);
      const { result, usage } = await recognizeImage({
        client,
        model,
        image: { bytes, mediaType: 'image/jpeg' },
      });
      outcome = {
        ok: true,
        file: label.file,
        latencyMs: Date.now() - started,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        ...matchTiles(label, {
          concealed: result.concealed,
          melds: result.melds,
          bonus: result.bonus,
        }),
      };
    } catch (error) {
      outcome = {
        ok: false,
        file: label.file,
        expected,
        latencyMs: Date.now() - started,
        error: error instanceof RecognizeError ? error.code : (error as Error).message,
      };
    }
    items.push({ tags, outcome });
    const mark = outcome.ok ? (outcome.exact ? 'ok  ' : 'diff') : 'FAIL';
    console.log(`[${i + 1}/${labels.length}] ${mark} ${label.file} (${ms(outcome.latencyMs)})`);

    upstreamStreak = !outcome.ok && outcome.error === 'upstream' ? upstreamStreak + 1 : 0;
    if (upstreamStreak >= MAX_CONSECUTIVE_UPSTREAM) {
      stoppedEarly = true;
      console.log(
        `\nStopping after ${MAX_CONSECUTIVE_UPSTREAM} "upstream" failures in a row. That usually ` +
          'means a rate limit, an invalid key or an outage, not a misread photo. The results ' +
          'below cover only the photos already run.',
      );
      break;
    }
  }

  const outcomes = items.map((i) => i.outcome);
  console.log('');
  printSummary('Overall', summarize(outcomes, prices));
  for (const by of ['set', 'lighting'] as const) {
    console.log(`\nBy ${by}`);
    for (const [key, s] of groupSummaries(items, by, prices)) {
      console.log(
        `  ${key.padEnd(18)} n=${String(s.photos).padStart(3)}  tiles ${pct(s.tileAccuracy)}  zero-correction ${pct(s.zeroCorrectionRate)}`,
      );
    }
  }
  const failures = summarize(outcomes, prices).failures;
  if (failures.length > 0) {
    console.log('\nFailures (their latency is left out of the percentiles above)');
    for (const f of failures) console.log(`  ${f.file}: ${f.error}`);
    if (failures.some((f) => f.error === 'upstream')) {
      console.log(
        '  Note: "upstream" covers any API error other than a timeout, including a rate limit ' +
          'or an invalid key. Treat a run with many of them as inconclusive, not as bad accuracy.',
      );
    }
  }
  if (stoppedEarly) process.exitCode = 1;
  console.log(
    `\nCost uses $${prices.input}/M input and $${prices.output}/M output tokens; ` +
      'override with --input-price and --output-price for another model.',
  );
};

main().catch((error: unknown) => {
  console.error(`Evaluation stopped: ${(error as Error).message}`);
  process.exit(1);
});
