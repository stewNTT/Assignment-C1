const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildTimeline,
  createTimelineState,
  finalizeTimeline,
  floorToBucket,
  renderTimelineChart,
  updateTimeline,
} = require('../src/core/timeline');

test('floorToBucket rounds timestamps down to the selected bucket', () => {
  const timestamp = new Date('2026-10-22T10:37:45.000Z');

  assert.equal(floorToBucket(timestamp, '15m').toISOString(), '2026-10-22T10:30:00.000Z');
  assert.equal(floorToBucket(timestamp, '30m').toISOString(), '2026-10-22T10:30:00.000Z');
  assert.equal(floorToBucket(timestamp, '1h').toISOString(), '2026-10-22T10:00:00.000Z');
});

test('updateTimeline counts only error lines and tracks malformed lines', () => {
  const state = createTimelineState('15m');

  updateTimeline(state, '2026-10-22 10:01:00 [INFO] Boot');
  updateTimeline(state, '2026-10-22 10:03:00 [ERROR] Timeout');
  updateTimeline(state, '2026-10-22 10:14:59 [ERROR] Timeout');
  updateTimeline(state, 'bad line');

  const timeline = finalizeTimeline(state);

  assert.equal(timeline.malformedLines, 1);
  assert.deepEqual(timeline.points, [
    {
      bucketStart: '2026-10-22T10:00:00.000Z',
      label: '2026-10-22 10:00 (15m)',
      count: 2,
    },
  ]);
});

test('renderTimelineChart returns ascii bars for sorted points', () => {
  const chart = renderTimelineChart([
    { label: '2026-10-22 10:00 (15m)', count: 1 },
    { label: '2026-10-22 10:15 (15m)', count: 2 },
  ]);

  assert.equal(
    chart,
    [
      '2026-10-22 10:00 (15m) | ########## (1)',
      '2026-10-22 10:15 (15m) | #################### (2)',
    ].join('\n'),
  );
});

test('buildTimeline aggregates multiple buckets from a file', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-timeline-'));
  const filePath = path.join(tempDir, 'timeline.log');

  fs.writeFileSync(filePath, [
    '2026-10-22 10:01:00 [ERROR] Timeout',
    '2026-10-22 10:10:00 [ERROR] Timeout',
    '2026-10-22 10:35:00 [ERROR] Disk full',
    '2026-10-22 10:36:00 [WARN] Degraded',
    'oops',
  ].join('\n'), 'utf8');

  const timeline = await buildTimeline(filePath, '30m');

  assert.deepEqual(timeline, {
    bucket: '30m',
    malformedLines: 1,
    points: [
      {
        bucketStart: '2026-10-22T10:00:00.000Z',
        label: '2026-10-22 10:00 (30m)',
        count: 2,
      },
      {
        bucketStart: '2026-10-22T10:30:00.000Z',
        label: '2026-10-22 10:30 (30m)',
        count: 1,
      },
    ],
    chart: [
      '2026-10-22 10:00 (30m) | #################### (2)',
      '2026-10-22 10:30 (30m) | ########## (1)',
    ].join('\n'),
  });
});

test('finalizeTimeline handles files with no error events', () => {
  const timeline = finalizeTimeline(createTimelineState('1h'));

  assert.deepEqual(timeline, {
    bucket: '1h',
    malformedLines: 0,
    points: [],
    chart: 'No error events found.',
  });
});