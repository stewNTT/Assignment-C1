const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createDeterministicRandom,
  formatTimestamp,
  generateLogLine,
  normalizeRatios,
} = require('../src/core/gen-log');
const {
  generateLogFile,
  parseArgs,
} = require('../scripts/gen_log');

test('formatTimestamp renders UTC timestamps in log format', () => {
  const timestamp = new Date('2026-10-22T08:15:33.000Z');
  assert.equal(formatTimestamp(timestamp), '2026-10-22 08:15:33');
});

test('createDeterministicRandom returns reproducible sequence', () => {
  const first = createDeterministicRandom(42);
  const second = createDeterministicRandom(42);

  assert.equal(first(), second());
  assert.equal(first(), second());
});

test('normalizeRatios validates input ranges', () => {
  assert.deepEqual(normalizeRatios({ malformedRatio: 0.05, errorRatio: 0.2, warnRatio: 0.3 }), {
    malformed: 0.05,
    error: 0.2,
    warn: 0.3,
  });

  assert.throws(() => normalizeRatios({ malformedRatio: 1 }), /malformedRatio must be between 0 and 1/);
  assert.throws(() => normalizeRatios({ errorRatio: 0.8, warnRatio: 0.3 }), /errorRatio and warnRatio must be non-negative and sum to 1 or less/);
});

test('generateLogLine produces valid or malformed lines deterministically', () => {
  const random = createDeterministicRandom(123);
  const start = new Date('2026-01-01T00:00:00.000Z');

  const line = generateLogLine(0, start, random, {
    malformedRatio: 0,
    errorRatio: 1,
    warnRatio: 0,
  });

  assert.match(line, /^2026-01-01 00:00:00 \[ERROR\] /);
});

test('parseArgs reads generator cli options', () => {
  const options = parseArgs([
    'node',
    'scripts/gen_log.js',
    '--output',
    'out.log',
    '--target-mb',
    '2',
    '--seed',
    '99',
  ]);

  assert.equal(options.output, 'out.log');
  assert.equal(options.targetMb, 2);
  assert.equal(options.seed, 99);
});

test('generateLogFile writes synthetic log near requested size', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-gen-'));
  const outputPath = path.join(tempDir, 'synthetic.log');

  const result = await generateLogFile({
    output: outputPath,
    targetMb: 0.01,
    seed: 1,
    malformedRatio: 0.02,
    errorRatio: 0.15,
    warnRatio: 0.2,
    start: '2026-01-01T00:00:00.000Z',
  });

  const stats = fs.statSync(outputPath);
  assert.equal(result.outputPath, outputPath);
  assert.ok(result.lineCount > 0);
  assert.ok(stats.size >= 0.01 * 1024 * 1024);
});