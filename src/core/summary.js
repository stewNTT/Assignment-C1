const { parseLogLine } = require('./parser');
const { streamLines } = require('./stream');

function createSummaryState() {
  return {
    levels: {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    },
    malformedLines: 0,
    firstTimestamp: null,
    lastTimestamp: null,
    errorFrequencies: new Map(),
  };
}

function updateSummary(state, line) {
  const parsed = parseLogLine(line);

  if (!parsed.ok) {
    state.malformedLines += 1;
    return state;
  }

  const { record } = parsed;
  state.levels[record.level] += 1;

  if (!state.firstTimestamp || record.timestamp < state.firstTimestamp) {
    state.firstTimestamp = record.timestamp;
  }

  if (!state.lastTimestamp || record.timestamp > state.lastTimestamp) {
    state.lastTimestamp = record.timestamp;
  }

  if (record.level === 'ERROR') {
    const nextCount = (state.errorFrequencies.get(record.message) || 0) + 1;
    state.errorFrequencies.set(record.message, nextCount);
  }

  return state;
}

function finalizeSummary(state) {
  const topErrors = Array.from(state.errorFrequencies.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, 5)
    .map(([message, count]) => ({ message, count }));

  return {
    levels: state.levels,
    malformedLines: state.malformedLines,
    firstTimestamp: state.firstTimestamp ? state.firstTimestamp.toISOString() : null,
    lastTimestamp: state.lastTimestamp ? state.lastTimestamp.toISOString() : null,
    topErrors,
  };
}

async function summarizeFile(filePath) {
  const state = createSummaryState();

  for await (const line of streamLines(filePath)) {
    updateSummary(state, line);
  }

  return finalizeSummary(state);
}

module.exports = {
  createSummaryState,
  updateSummary,
  finalizeSummary,
  summarizeFile,
};