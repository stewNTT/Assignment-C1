const LOG_LINE_PATTERN = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(INFO|WARN|ERROR)\] (.*)$/;

function parseTimestamp(timestampText) {
  const isoText = timestampText.replace(' ', 'T') + 'Z';
  const timestamp = new Date(isoText);

  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return timestamp;
}

function parseLogLine(line) {
  if (typeof line !== 'string') {
    return {
      ok: false,
      reason: 'non_string_line',
    };
  }

  const match = line.match(LOG_LINE_PATTERN);

  if (!match) {
    return {
      ok: false,
      reason: 'invalid_format',
    };
  }

  const [, timestampText, level, message] = match;
  const timestamp = parseTimestamp(timestampText);

  if (!timestamp) {
    return {
      ok: false,
      reason: 'invalid_timestamp',
    };
  }

  return {
    ok: true,
    record: {
      timestamp,
      timestampText,
      level,
      message,
      raw: line,
    },
  };
}

module.exports = {
  parseLogLine,
  parseTimestamp,
  LOG_LINE_PATTERN,
};