function pad(number) {
  return String(number).padStart(2, '0');
}

function formatTimestamp(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('-') + ' ' + [
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join(':');
}

function createDeterministicRandom(seed = 123456789) {
  let state = seed >>> 0;

  return function nextRandom() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pickLevel(randomValue, ratios) {
  if (randomValue < ratios.error) {
    return 'ERROR';
  }

  if (randomValue < ratios.error + ratios.warn) {
    return 'WARN';
  }

  return 'INFO';
}

function normalizeRatios(options = {}) {
  const malformedRatio = options.malformedRatio ?? 0.01;
  const errorRatio = options.errorRatio ?? 0.1;
  const warnRatio = options.warnRatio ?? 0.2;

  if (malformedRatio < 0 || malformedRatio >= 1) {
    throw new Error('malformedRatio must be between 0 and 1');
  }

  if (errorRatio < 0 || warnRatio < 0 || errorRatio + warnRatio > 1) {
    throw new Error('errorRatio and warnRatio must be non-negative and sum to 1 or less');
  }

  return {
    malformed: malformedRatio,
    error: errorRatio,
    warn: warnRatio,
  };
}

function generateMalformedLine(index) {
  return `MALFORMED LINE ${index} ### corrupted payload`;
}

function generateMessage(level, index) {
  if (level === 'ERROR') {
    const errorMessages = [
      'Database timeout',
      'Disk full',
      'Auth failed',
      'Network flap',
      'Cache miss storm',
    ];
    return errorMessages[index % errorMessages.length];
  }

  if (level === 'WARN') {
    const warnMessages = [
      'Slow downstream',
      'Queue depth high',
      'Retry threshold reached',
      'High memory usage',
    ];
    return warnMessages[index % warnMessages.length];
  }

  const infoMessages = [
    'Service started',
    'Health check passed',
    'Worker heartbeat',
    'Request processed',
  ];
  return infoMessages[index % infoMessages.length];
}

function generateLogLine(index, startTime, random, options = {}) {
  const ratios = normalizeRatios(options);
  const malformedRoll = random();

  if (malformedRoll < ratios.malformed) {
    return generateMalformedLine(index);
  }

  const level = pickLevel(random(), ratios);
  const timestamp = new Date(startTime.getTime() + index * 1000);
  return `${formatTimestamp(timestamp)} [${level}] ${generateMessage(level, index)}`;
}

module.exports = {
  createDeterministicRandom,
  formatTimestamp,
  generateLogLine,
  normalizeRatios,
};