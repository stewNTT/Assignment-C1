const fs = require('node:fs');
const path = require('node:path');

function formatSummaryText(summary) {
  const topErrors = summary.topErrors.length === 0
    ? 'none'
    : summary.topErrors.map((item, index) => `${index + 1}. ${item.message} (${item.count})`).join('\n');

  return [
    'Summary',
    `INFO: ${summary.levels.INFO}`,
    `WARN: ${summary.levels.WARN}`,
    `ERROR: ${summary.levels.ERROR}`,
    `First timestamp: ${summary.firstTimestamp || 'n/a'}`,
    `Last timestamp: ${summary.lastTimestamp || 'n/a'}`,
    `Malformed lines: ${summary.malformedLines}`,
    'Top 5 ERROR messages:',
    topErrors,
  ].join('\n');
}

function formatTimelineText(timeline) {
  return [
    `Timeline bucket: ${timeline.bucket}`,
    `Malformed lines: ${timeline.malformedLines}`,
    timeline.chart,
  ].join('\n');
}

function formatGrepText(result) {
  return result.matches.join('\n');
}

function formatExplainText(result) {
  return [
    'Explain',
    `Endpoint: ${result.endpoint}`,
    `Model: ${result.model || 'n/a'}`,
    '',
    result.explanation,
  ].join('\n');
}

function formatJson(data) {
  return JSON.stringify(data, null, 2);
}

function formatSummaryMarkdown(summary) {
  const topErrors = summary.topErrors.length === 0
    ? '- None'
    : summary.topErrors.map((item) => `- ${item.message}: ${item.count}`).join('\n');

  return [
    '# logscope summary report',
    '',
    '## Level counts',
    '',
    `- INFO: ${summary.levels.INFO}`,
    `- WARN: ${summary.levels.WARN}`,
    `- ERROR: ${summary.levels.ERROR}`,
    '',
    '## Range',
    '',
    `- First timestamp: ${summary.firstTimestamp || 'n/a'}`,
    `- Last timestamp: ${summary.lastTimestamp || 'n/a'}`,
    `- Malformed lines: ${summary.malformedLines}`,
    '',
    '## Top 5 ERROR messages',
    '',
    topErrors,
  ].join('\n');
}

function formatTimelineMarkdown(timeline) {
  const rows = timeline.points.length === 0
    ? '| None | 0 |'
    : timeline.points.map((point) => `| ${point.label} | ${point.count} |`).join('\n');

  return [
    '# logscope timeline report',
    '',
    `- Bucket: ${timeline.bucket}`,
    `- Malformed lines: ${timeline.malformedLines}`,
    '',
    '## Buckets',
    '',
    '| Bucket | Error count |',
    '| --- | ---: |',
    rows,
    '',
    '## ASCII chart',
    '',
    '```text',
    timeline.chart,
    '```',
  ].join('\n');
}

function formatGrepMarkdown(result) {
  const lines = result.matches.length === 0
    ? '_No matches found._'
    : ['```text', ...result.matches, '```'].join('\n');

  return [
    '# logscope grep report',
    '',
    `- Level filter: ${result.filters.level || 'none'}`,
    `- Since filter: ${result.filters.since || 'none'}`,
    `- Malformed lines: ${result.malformedLines}`,
    '',
    '## Matches',
    '',
    lines,
  ].join('\n');
}

function formatExplainMarkdown(result) {
  const topErrors = result.summary.topErrors.length === 0
    ? '- None'
    : result.summary.topErrors.map((item) => `- ${item.message}: ${item.count}`).join('\n');

  return [
    '# logscope explain report',
    '',
    `- Endpoint: ${result.endpoint}`,
    `- Model: ${result.model || 'n/a'}`,
    '',
    '## Probable root cause',
    '',
    result.explanation,
    '',
    '## Source summary',
    '',
    `- INFO: ${result.summary.levels.INFO}`,
    `- WARN: ${result.summary.levels.WARN}`,
    `- ERROR: ${result.summary.levels.ERROR}`,
    `- First timestamp: ${result.summary.firstTimestamp || 'n/a'}`,
    `- Last timestamp: ${result.summary.lastTimestamp || 'n/a'}`,
    `- Malformed lines: ${result.summary.malformedLines}`,
    '',
    '## Top 5 ERROR messages',
    '',
    topErrors,
  ].join('\n');
}

function getReportFileName(commandName, now = new Date()) {
  const safeStamp = now.toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
  return `logscope-${commandName}-${safeStamp}.md`;
}

function writeMarkdownReport(outputDir, commandName, markdown, now = new Date()) {
  const fileName = getReportFileName(commandName, now);
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, markdown, 'utf8');
  return filePath;
}

function renderOutput(commandName, data, format, outputDir = process.cwd()) {
  if (format === 'json') {
    return {
      destination: 'stdout',
      content: formatJson(data),
    };
  }

  if (format === 'md') {
    let markdown;

    if (commandName === 'summary') {
      markdown = formatSummaryMarkdown(data);
    } else if (commandName === 'timeline') {
      markdown = formatTimelineMarkdown(data);
    } else if (commandName === 'grep') {
      markdown = formatGrepMarkdown(data);
    } else if (commandName === 'explain') {
      markdown = formatExplainMarkdown(data);
    } else {
      throw new Error(`Unsupported command format: ${commandName}`);
    }

    return {
      destination: 'file',
      filePath: writeMarkdownReport(outputDir, commandName, markdown),
      content: markdown,
    };
  }

  if (format == null || format === 'text') {
    if (commandName === 'summary') {
      return {
        destination: 'stdout',
        content: formatSummaryText(data),
      };
    }

    if (commandName === 'timeline') {
      return {
        destination: 'stdout',
        content: formatTimelineText(data),
      };
    }

    if (commandName === 'grep') {
      return {
        destination: 'stdout',
        content: formatGrepText(data),
      };
    }

    if (commandName === 'explain') {
      return {
        destination: 'stdout',
        content: formatExplainText(data),
      };
    }

    throw new Error(`Unsupported command format: ${commandName}`);
  }

  throw new Error(`Unsupported output format: ${format}`);
}

module.exports = {
  formatExplainMarkdown,
  formatExplainText,
  formatGrepMarkdown,
  formatGrepText,
  formatJson,
  formatSummaryMarkdown,
  formatSummaryText,
  formatTimelineMarkdown,
  formatTimelineText,
  getReportFileName,
  renderOutput,
  writeMarkdownReport,
};