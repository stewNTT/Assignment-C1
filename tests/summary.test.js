const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createSummaryState,
  updateSummary,
  finalizeSummary,
  summarizeFile,
} = require('../src/core/summary');

test('updateSummary tracks level counts, malformed lines, and timestamp bounds', () => {
  const state = createSummaryState();

  updateSummary(state, '2026-10-22 08:15:33 [INFO] Service started');
  updateSummary(state, '2026-10-22 08:16:33 [WARN] Queue depth high');
  updateSummary(state, '2026-10-22 08:17:33 [ERROR] Database timeout');
  updateSummary(state, 'malformed');

  const summary = finalizeSummary(state);

  assert.deepEqual(summary.levels, {
    INFO: 1,
    WARN: 1,
    ERROR: 1,
  });
  assert.equal(summary.malformedLines, 1);
  assert.equal(summary.firstTimestamp, '2026-10-22T08:15:33.000Z');
  assert.equal(summary.lastTimestamp, '2026-10-22T08:17:33.000Z');
  assert.deepEqual(summary.topErrors, [
    { message: 'Database timeout', count: 1 },
  ]);
});

test('finalizeSummary returns top five error messages by frequency', () => {
  const state = createSummaryState();
  const lines = [
    '2026-10-22 08:00:00 [ERROR] Disk full',
    '2026-10-22 08:01:00 [ERROR] Disk full',
    '2026-10-22 08:02:00 [ERROR] Auth failed',
    '2026-10-22 08:03:00 [ERROR] Auth failed',
    '2026-10-22 08:04:00 [ERROR] Auth failed',
    '2026-10-22 08:05:00 [ERROR] Cache miss storm',
    '2026-10-22 08:06:00 [ERROR] DNS failure',
    '2026-10-22 08:07:00 [ERROR] Network flap',
    '2026-10-22 08:08:00 [ERROR] Memory pressure',
  ];

  for (const line of lines) {
    updateSummary(state, line);
  }

  const summary = finalizeSummary(state);

  assert.deepEqual(summary.topErrors, [
    { message: 'Auth failed', count: 3 },
    { message: 'Disk full', count: 2 },
    { message: 'Cache miss storm', count: 1 },
    { message: 'DNS failure', count: 1 },
    { message: 'Memory pressure', count: 1 },
  ]);
});

test('summarizeFile processes a log file in one pass', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-summary-'));
  const filePath = path.join(tempDir, 'app.log');

  fs.writeFileSync(filePath, [
    '2026-10-22 09:00:00 [INFO] Boot',
    'bad line',
    '2026-10-22 09:05:00 [ERROR] Timeout',
    '2026-10-22 09:06:00 [ERROR] Timeout',
    '2026-10-22 09:07:00 [WARN] Slow downstream',
  ].join('\n'), 'utf8');

  const summary = await summarizeFile(filePath);

  assert.deepEqual(summary, {
    levels: {
      INFO: 1,
      WARN: 1,
      ERROR: 2,
    },
    malformedLines: 1,
    firstTimestamp: '2026-10-22T09:00:00.000Z',
    lastTimestamp: '2026-10-22T09:07:00.000Z',
    topErrors: [
      { message: 'Timeout', count: 2 },
    ],
  });
});

test('finalizeSummary handles files with no valid lines', () => {
  const summary = finalizeSummary(createSummaryState());

  assert.deepEqual(summary, {
    levels: {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    },
    malformedLines: 0,
    firstTimestamp: null,
    lastTimestamp: null,
    topErrors: [],
  });
});