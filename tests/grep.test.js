const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createGrepState,
  finalizeGrep,
  grepFile,
  matchesGrepFilters,
  normalizeGrepOptions,
  updateGrep,
} = require('../src/core/grep');

test('normalizeGrepOptions parses level and since filters', () => {
  const options = normalizeGrepOptions({
    level: 'ERROR',
    since: '2026-10-22 10:15:00',
  });

  assert.equal(options.level, 'ERROR');
  assert.equal(options.since.toISOString(), '2026-10-22T10:15:00.000Z');
});

test('normalizeGrepOptions rejects invalid since values', () => {
  assert.throws(
    () => normalizeGrepOptions({ since: 'not-a-date' }),
    /Invalid since timestamp: not-a-date/,
  );
});

test('matchesGrepFilters applies level and since constraints', () => {
  const state = createGrepState({
    level: 'ERROR',
    since: '2026-10-22 10:15:00',
  });

  assert.equal(matchesGrepFilters({
    level: 'ERROR',
    timestamp: new Date('2026-10-22T10:15:00.000Z'),
  }, state.filters), true);

  assert.equal(matchesGrepFilters({
    level: 'WARN',
    timestamp: new Date('2026-10-22T10:20:00.000Z'),
  }, state.filters), false);

  assert.equal(matchesGrepFilters({
    level: 'ERROR',
    timestamp: new Date('2026-10-22T10:14:59.000Z'),
  }, state.filters), false);
});

test('updateGrep collects matching raw lines and counts malformed ones', () => {
  const state = createGrepState({ level: 'ERROR' });

  updateGrep(state, '2026-10-22 10:10:00 [INFO] Boot');
  updateGrep(state, '2026-10-22 10:11:00 [ERROR] Timeout');
  updateGrep(state, 'broken');

  const result = finalizeGrep(state);

  assert.equal(result.malformedLines, 1);
  assert.deepEqual(result.matches, [
    '2026-10-22 10:11:00 [ERROR] Timeout',
  ]);
});

test('grepFile streams and filters by level and since', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-grep-'));
  const filePath = path.join(tempDir, 'grep.log');

  fs.writeFileSync(filePath, [
    '2026-10-22 10:10:00 [INFO] Boot',
    '2026-10-22 10:15:00 [ERROR] Timeout',
    '2026-10-22 10:20:00 [ERROR] Disk full',
    '2026-10-22 10:25:00 [WARN] Slow downstream',
    'oops',
  ].join('\n'), 'utf8');

  const result = await grepFile(filePath, {
    level: 'ERROR',
    since: '2026-10-22 10:16:00',
  });

  assert.deepEqual(result, {
    filters: {
      level: 'ERROR',
      since: '2026-10-22T10:16:00.000Z',
    },
    malformedLines: 1,
    matches: [
      '2026-10-22 10:20:00 [ERROR] Disk full',
    ],
  });
});

test('finalizeGrep handles empty matches', () => {
  const result = finalizeGrep(createGrepState());

  assert.deepEqual(result, {
    filters: {
      level: null,
      since: null,
    },
    malformedLines: 0,
    matches: [],
  });
});