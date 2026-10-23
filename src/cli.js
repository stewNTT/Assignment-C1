#!/usr/bin/env node

const path = require('node:path');

const { summarizeFile } = require('./core/summary');
const { buildTimeline } = require('./core/timeline');
const { grepFile } = require('./core/grep');
const { renderOutput } = require('./core/formatters');

function printHelp() {
  const helpText = [
    'Usage: logscope <command> <file> [options]',
    '',
    'Commands:',
    '  summary <file>                      Summarize log levels and errors',
    '  timeline <file> --bucket <value>    Show error counts by time bucket',
    '  grep <file> [--level LEVEL] [--since "YYYY-MM-DD HH:mm:ss"]',
    '',
    'Global options:',
    '  --format <json|md>',
  ].join('\n');

  process.stdout.write(`${helpText}\n`);
}

function parseCliArgs(argv) {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  const command = args[0];
  const file = args[1];

  if (!command || !file) {
    throw new Error('A command and file path are required.');
  }

  const options = {
    command,
    file,
    format: null,
  };

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];
    const nextValue = args[index + 1];

    if (arg === '--format') {
      options.format = nextValue;
      index += 1;
    } else if (arg === '--bucket') {
      options.bucket = nextValue;
      index += 1;
    } else if (arg === '--level') {
      options.level = nextValue;
      index += 1;
    } else if (arg === '--since') {
      options.since = nextValue;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function runCommand(options) {
  const filePath = path.resolve(options.file);

  if (options.command === 'summary') {
    return {
      commandName: 'summary',
      data: await summarizeFile(filePath),
    };
  }

  if (options.command === 'timeline') {
    if (!options.bucket) {
      throw new Error('timeline requires --bucket <15m|30m|1h>');
    }

    return {
      commandName: 'timeline',
      data: await buildTimeline(filePath, options.bucket),
    };
  }

  if (options.command === 'grep') {
    return {
      commandName: 'grep',
      data: await grepFile(filePath, {
        level: options.level,
        since: options.since,
      }),
    };
  }

  throw new Error(`Unsupported command: ${options.command}`);
}

async function main(argv = process.argv) {
  const options = parseCliArgs(argv);

  if (options.help) {
    printHelp();
    return 0;
  }

  const { commandName, data } = await runCommand(options);
  const output = renderOutput(commandName, data, options.format, process.cwd());

  if (output.destination === 'file') {
    process.stdout.write(`${output.filePath}\n`);
    return 0;
  }

  process.stdout.write(`${output.content}\n`);
  return 0;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parseCliArgs,
  printHelp,
  runCommand,
};