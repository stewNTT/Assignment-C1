const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  formatGrepMarkdown,
  formatGrepText,
  formatJson,
  formatSummaryMarkdown,
  formatSummaryText,
  formatTimelineMarkdown,
  formatTimelineText,
  getReportFileName,
  writeMarkdownReport,
} = require('../src/core/formatters');

test('formatSummaryText renders human-readable output', () => {
  const text = formatSummaryText({
    levels: { INFO: 2, WARN: 1, ERROR: 3 },
    firstTimestamp: '2026-10-22T09:00:00.000Z',
    lastTimestamp: '2026-10-22T09:30:00.000Z',
    malformedLines: 4,
    topErrors: [
      { message: 'Timeout', count: 2 },
      { message: 'Disk full', count: 1 },
    ],
  });

  assert.equal(text, [
    'Summary',
    'INFO: 2',
    'WARN: 1',
    'ERROR: 3',
    'First timestamp: 2026-10-22T09:00:00.000Z',
    'Last timestamp: 2026-10-22T09:30:00.000Z',
    'Malformed lines: 4',
    'Top 5 ERROR messages:',
    '1. Timeout (2)\n2. Disk full (1)',
  ].join('\n'));
});

test('formatTimelineText renders timeline details and chart', () => {
  const text = formatTimelineText({
    bucket: '15m',
    malformedLines: 1,
    chart: '2026-10-22 10:00 (15m) | ########## (1)',
  });

  assert.equal(text, [
    'Timeline bucket: 15m',
    'Malformed lines: 1',
    '2026-10-22 10:00 (15m) | ########## (1)',
  ].join('\n'));
});

test('formatGrepText joins matched lines', () => {
  assert.equal(formatGrepText({
    matches: [
      '2026-10-22 10:15:00 [ERROR] Timeout',
      '2026-10-22 10:20:00 [ERROR] Disk full',
    ],
  }), [
    '2026-10-22 10:15:00 [ERROR] Timeout',
    '2026-10-22 10:20:00 [ERROR] Disk full',
  ].join('\n'));
});

test('formatJson renders structured json', () => {
  assert.equal(formatJson({ ok: true }), '{\n  "ok": true\n}');
});

test('markdown formatters render report content', () => {
  const summaryMarkdown = formatSummaryMarkdown({
    levels: { INFO: 1, WARN: 0, ERROR: 1 },
    firstTimestamp: null,
    lastTimestamp: null,
    malformedLines: 2,
    topErrors: [{ message: 'Timeout', count: 1 }],
  });
  const timelineMarkdown = formatTimelineMarkdown({
    bucket: '30m',
    malformedLines: 0,
    points: [{ label: '2026-10-22 10:00 (30m)', count: 2 }],
    chart: '2026-10-22 10:00 (30m) | #################### (2)',
  });
  const grepMarkdown = formatGrepMarkdown({
    filters: { level: 'ERROR', since: '2026-10-22T10:00:00.000Z' },
    malformedLines: 1,
    matches: ['2026-10-22 10:15:00 [ERROR] Timeout'],
  });

  assert.match(summaryMarkdown, /# logscope summary report/);
  assert.match(summaryMarkdown, /- Timeout: 1/);
  assert.match(timelineMarkdown, /# logscope timeline report/);
  assert.match(timelineMarkdown, /\| 2026-10-22 10:00 \(30m\) \| 2 \|/);
  assert.match(grepMarkdown, /# logscope grep report/);
  assert.match(grepMarkdown, /2026-10-22 10:15:00 \[ERROR\] Timeout/);
});

test('writeMarkdownReport writes report file to disk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-report-'));
  const timestamp = new Date('2026-10-22T12:34:56.000Z');
  const filePath = writeMarkdownReport(tempDir, 'summary', '# report', timestamp);

  assert.equal(path.basename(filePath), getReportFileName('summary', timestamp));
  assert.equal(fs.readFileSync(filePath, 'utf8'), '# report');
});