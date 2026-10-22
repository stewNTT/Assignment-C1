const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { parseLogLine, parseTimestamp } = require('../src/core/parser');
const { streamLines } = require('../src/core/stream');

test('parseLogLine parses a valid log line', () => {
  const result = parseLogLine('2026-10-22 08:15:33 [ERROR] Database timeout');

  assert.equal(result.ok, true);
  assert.equal(result.record.timestampText, '2026-10-22 08:15:33');
  assert.equal(result.record.level, 'ERROR');
  assert.equal(result.record.message, 'Database timeout');
  assert.equal(result.record.raw, '2026-10-22 08:15:33 [ERROR] Database timeout');
  assert.equal(result.record.timestamp.toISOString(), '2026-10-22T08:15:33.000Z');
});

test('parseLogLine rejects malformed lines', () => {
  const result = parseLogLine('bad line');

  assert.deepEqual(result, {
    ok: false,
    reason: 'invalid_format',
  });
});

test('parseLogLine rejects invalid timestamp values', () => {
  const result = parseLogLine('2026-13-22 08:15:33 [INFO] impossible month');

  assert.deepEqual(result, {
    ok: false,
    reason: 'invalid_timestamp',
  });
});

test('parseLogLine rejects non-string input safely', () => {
  const result = parseLogLine(null);

  assert.deepEqual(result, {
    ok: false,
    reason: 'non_string_line',
  });
});

test('parseTimestamp returns null for invalid date text', () => {
  assert.equal(parseTimestamp('not-a-timestamp'), null);
});

test('streamLines yields file contents line by line', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-'));
  const filePath = path.join(tempDir, 'sample.log');
  fs.writeFileSync(filePath, 'first\nsecond\r\nthird\n', 'utf8');

  const lines = [];
  for await (const line of streamLines(filePath)) {
    lines.push(line);
  }

  assert.deepEqual(lines, ['first', 'second', 'third']);
});