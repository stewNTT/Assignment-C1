const { parseLogLine } = require('./parser');
const { streamLines } = require('./stream');

const BUCKET_SIZES = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
};

function getBucketSize(bucket) {
  const bucketSize = BUCKET_SIZES[bucket];

  if (!bucketSize) {
    throw new Error(`Unsupported bucket: ${bucket}`);
  }

  return bucketSize;
}

function floorToBucket(timestamp, bucket) {
  const bucketSize = getBucketSize(bucket);
  const bucketStartMs = Math.floor(timestamp.getTime() / bucketSize) * bucketSize;
  return new Date(bucketStartMs);
}

function createTimelineState(bucket) {
  getBucketSize(bucket);

  return {
    bucket,
    malformedLines: 0,
    buckets: new Map(),
  };
}

function updateTimeline(state, line) {
  const parsed = parseLogLine(line);

  if (!parsed.ok) {
    state.malformedLines += 1;
    return state;
  }

  const { record } = parsed;

  if (record.level !== 'ERROR') {
    return state;
  }

  const bucketStart = floorToBucket(record.timestamp, state.bucket).toISOString();
  const nextCount = (state.buckets.get(bucketStart) || 0) + 1;
  state.buckets.set(bucketStart, nextCount);

  return state;
}

function formatBucketLabel(bucketIso, bucket) {
  const bucketDate = new Date(bucketIso);
  const datePart = bucketDate.toISOString().slice(0, 10);
  const timePart = bucketDate.toISOString().slice(11, 16);
  return `${datePart} ${timePart} (${bucket})`;
}

function renderTimelineChart(points) {
  if (points.length === 0) {
    return 'No error events found.';
  }

  const maxCount = Math.max(...points.map((point) => point.count));

  return points
    .map((point) => {
      const barLength = maxCount === 0 ? 0 : Math.max(1, Math.round((point.count / maxCount) * 20));
      const bar = '#'.repeat(barLength);
      return `${point.label} | ${bar} (${point.count})`;
    })
    .join('\n');
}

function finalizeTimeline(state) {
  const points = Array.from(state.buckets.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([bucketStart, count]) => ({
      bucketStart,
      label: formatBucketLabel(bucketStart, state.bucket),
      count,
    }));

  return {
    bucket: state.bucket,
    malformedLines: state.malformedLines,
    points,
    chart: renderTimelineChart(points),
  };
}

async function buildTimeline(filePath, bucket) {
  const state = createTimelineState(bucket);

  for await (const line of streamLines(filePath)) {
    updateTimeline(state, line);
  }

  return finalizeTimeline(state);
}

module.exports = {
  BUCKET_SIZES,
  buildTimeline,
  createTimelineState,
  finalizeTimeline,
  floorToBucket,
  formatBucketLabel,
  renderTimelineChart,
  updateTimeline,
};