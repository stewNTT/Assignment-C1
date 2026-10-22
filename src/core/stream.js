const fs = require('node:fs');
const readline = require('node:readline');

async function *streamLines(filePath) {
  const input = fs.createReadStream(filePath, {
    encoding: 'utf8',
  });

  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      yield line;
    }
  } finally {
    rl.close();
    input.destroy();
  }
}

module.exports = {
  streamLines,
};