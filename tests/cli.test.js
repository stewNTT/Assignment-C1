const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { parseCliArgs } = require('../src/cli');
const { renderOutput } = require('../src/core/formatters');

const cliPath = path.join(__dirname, '..', 'src', 'cli.js');

test('parseCliArgs parses summary command options', () => {
  const parsed = parseCliArgs(['node', 'cli.js', 'summary', 'sample.log', '--format', 'json']);

  assert.deepEqual(parsed, {
    command: 'summary',
    file: 'sample.log',
    format: 'json',
  });
});

test('parseCliArgs parses explain command options', () => {
  const parsed = parseCliArgs(['node', 'cli.js', 'explain', 'sample.log', '--format', 'md']);

  assert.deepEqual(parsed, {
    command: 'explain',
    file: 'sample.log',
    format: 'md',
  });
});

test('renderOutput writes markdown reports when requested', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-cli-report-'));
  const result = renderOutput('summary', {
    levels: { INFO: 1, WARN: 0, ERROR: 0 },
    malformedLines: 0,
    firstTimestamp: null,
    lastTimestamp: null,
    topErrors: [],
  }, 'md', tempDir);

  assert.equal(result.destination, 'file');
  assert.ok(fs.existsSync(result.filePath));
});

test('cli summary command prints text output', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-cli-summary-'));
  const logPath = path.join(tempDir, 'sample.log');
  fs.writeFileSync(logPath, [
    '2026-10-22 09:00:00 [INFO] Boot',
    '2026-10-22 09:05:00 [ERROR] Timeout',
    'bad line',
  ].join('\n'), 'utf8');

  const result = spawnSync(process.execPath, [cliPath, 'summary', logPath], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Summary/);
  assert.match(result.stdout, /ERROR: 1/);
  assert.match(result.stdout, /Malformed lines: 1/);
});

test('cli timeline command prints ascii chart', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-cli-timeline-'));
  const logPath = path.join(tempDir, 'sample.log');
  fs.writeFileSync(logPath, [
    '2026-10-22 10:01:00 [ERROR] Timeout',
    '2026-10-22 10:03:00 [ERROR] Disk full',
  ].join('\n'), 'utf8');

  const result = spawnSync(process.execPath, [cliPath, 'timeline', logPath, '--bucket', '15m'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Timeline bucket: 15m/);
  assert.match(result.stdout, /2026-10-22 10:00 \(15m\) \|/);
});

test('cli grep command supports json output', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-cli-grep-'));
  const logPath = path.join(tempDir, 'sample.log');
  fs.writeFileSync(logPath, [
    '2026-10-22 10:10:00 [INFO] Boot',
    '2026-10-22 10:20:00 [ERROR] Disk full',
  ].join('\n'), 'utf8');

  const result = spawnSync(process.execPath, [cliPath, 'grep', logPath, '--level', 'ERROR', '--format', 'json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.matches, ['2026-10-22 10:20:00 [ERROR] Disk full']);
});

test('cli explain command reports endpoint failures cleanly', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-cli-explain-'));
  const logPath = path.join(tempDir, 'sample.log');
  fs.writeFileSync(logPath, [
    '2026-10-22 10:10:00 [INFO] Boot',
    '2026-10-22 10:20:00 [ERROR] Disk full',
    '2026-10-22 10:21:00 [ERROR] Disk full',
  ].join('\n'), 'utf8');

  const result = spawnSync(process.execPath, [cliPath, 'explain', logPath, '--format', 'json'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LOGSCOPE_LLM_ENDPOINT: 'https://example.test/explain',
      LOGSCOPE_LLM_MODEL: 'demo-model',
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /fetch failed|getaddrinfo|ENOTFOUND|timed out/i);
});