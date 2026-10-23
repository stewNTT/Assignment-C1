const { parseLogLine, parseTimestamp } = require('./parser');
const { streamLines } = require('./stream');

function normalizeGrepOptions(options = {}) {
  const normalized = {
    level: options.level || null,
    since: null,
  };

  if (options.since != null) {
    const sinceTimestamp = parseTimestamp(options.since);

    if (!sinceTimestamp) {
      throw new Error(`Invalid since timestamp: ${options.since}`);
    }

    normalized.since = sinceTimestamp;
  }

  return normalized;
}

function matchesGrepFilters(record, options) {
  if (options.level && record.level !== options.level) {
    return false;
  }

  if (options.since && record.timestamp < options.since) {
    return false;
  }

  return true;
}

function createGrepState(options = {}) {
  return {
    filters: normalizeGrepOptions(options),
    malformedLines: 0,
    matches: [],
  };
}

function updateGrep(state, line) {
  const parsed = parseLogLine(line);

  if (!parsed.ok) {
    state.malformedLines += 1;
    return state;
  }

  if (matchesGrepFilters(parsed.record, state.filters)) {
    state.matches.push(parsed.record.raw);
  }

  return state;
}

function finalizeGrep(state) {
  return {
    filters: {
      level: state.filters.level,
      since: state.filters.since ? state.filters.since.toISOString() : null,
    },
    malformedLines: state.malformedLines,
    matches: state.matches,
  };
}

async function grepFile(filePath, options = {}) {
  const state = createGrepState(options);

  for await (const line of streamLines(filePath)) {
    updateGrep(state, line);
  }

  return finalizeGrep(state);
}

module.exports = {
  createGrepState,
  finalizeGrep,
  grepFile,
  matchesGrepFilters,
  normalizeGrepOptions,
  updateGrep,
};