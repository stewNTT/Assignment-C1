#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const {
  createDeterministicRandom,
  generateLogLine,
} = require('../src/core/gen-log');

function parseArgs(argv) {
  const options = {
    output: 'synthetic.log',
    targetMb: 100,
    seed: 123456789,
    malformedRatio: 0.01,
    errorRatio: 0.1,
    warnRatio: 0.2,
    start: '2026-01-01T00:00:00.000Z',
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === '--output') {
      options.output = nextValue;
      index += 1;
    } else if (arg === '--target-mb') {
      options.targetMb = Number(nextValue);
      index += 1;
    } else if (arg === '--seed') {
      options.seed = Number(nextValue);
      index += 1;
    } else if (arg === '--malformed-ratio') {
      options.malformedRatio = Number(nextValue);
      index += 1;
    } else if (arg === '--error-ratio') {
      options.errorRatio = Number(nextValue);
      index += 1;
    } else if (arg === '--warn-ratio') {
      options.warnRatio = Number(nextValue);
      index += 1;
    } else if (arg === '--start') {
      options.start = nextValue;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function generateLogFile(options) {
  const targetBytes = Math.max(1, Math.floor(options.targetMb * 1024 * 1024));
  const outputPath = path.resolve(options.output);
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  const startTime = new Date(options.start);
  if (Number.isNaN(startTime.getTime())) {
    throw new Error(`Invalid start timestamp: ${options.start}`);
  }

  const random = createDeterministicRandom(options.seed);
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

  let bytesWritten = 0;
  let lineCount = 0;

  while (bytesWritten < targetBytes) {
    const line = generateLogLine(lineCount, startTime, random, options);
    const chunk = `${line}\n`;
    bytesWritten += Buffer.byteLength(chunk, 'utf8');
    lineCount += 1;

    if (!stream.write(chunk)) {
      await new Promise((resolve) => stream.once('drain', resolve));
    }
  }

  await new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  return {
    outputPath,
    bytesWritten,
    lineCount,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const result = await generateLogFile(options);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  generateLogFile,
  parseArgs,
};