# logscope

`logscope` is a Node.js CLI for streaming analysis of large log files without loading the entire file into memory.

## Prerequisites
- Node.js 18+ recommended
- npm

## Install dependencies
```bash
npm install
```

## Run without installing globally
Use `npx` from the project directory:

```bash
npx logscope summary sample.log
npx logscope timeline sample.log --bucket 15m
npx logscope grep sample.log --level ERROR --since "2026-10-23 09:00:00"
```

You can also use `npm exec`:

```bash
npm exec logscope -- summary sample.log
```

## Enable the `logscope` command globally for your machine
From the project directory, run:

```bash
npm link
```

Then you can use:

```bash
logscope summary sample.log
logscope timeline sample.log --bucket 15m
logscope grep sample.log --level ERROR --since "2026-10-23 09:00:00"
```

## If `logscope` is not recognized
`npm link` and global installs use npm's global bin directory. If that directory is not on your `PATH`, add it once for your machine.

To see that directory:

```bash
npm bin -g
```

After adding it to `PATH`, reopen your terminal.

## Commands
### Summary
```bash
logscope summary <file>
```
Outputs:
- count by level
- top 5 ERROR messages
- first valid timestamp
- last valid timestamp
- malformed line count

### Timeline
```bash
logscope timeline <file> --bucket <15m|30m|1h>
```
Outputs error counts per time bucket as an ASCII chart.

### Grep
```bash
logscope grep <file> [--level <LEVEL>] [--since "YYYY-MM-DD HH:mm:ss"]
```
Prints matching original log lines.

### Explain
```bash
logscope explain <file>
```
Sends the summary/top errors to an LLM endpoint and prints a probable root-cause summary.

Before using `explain`, set these environment variables in your terminal session:

```bash
set LOGSCOPE_LLM_ENDPOINT=https://api.anthropic.com/v1/messages
set LOGSCOPE_LLM_MODEL=claude-sonnet-4-5
set LOGSCOPE_LLM_API_KEY=your_api_key_here
set LOGSCOPE_LLM_MAX_TOKENS=2000
```

Notes:
- `LOGSCOPE_LLM_ENDPOINT` is required.
- `LOGSCOPE_LLM_MODEL` is required by most providers.
- `LOGSCOPE_LLM_API_KEY` is required for authenticated endpoints.
- `LOGSCOPE_LLM_MAX_TOKENS` is optional; default is `2000`.
- `LOGSCOPE_LLM_TIMEOUT_MS` is optional; default is `10000`.

Example:

```bash
logscope explain sample.log --format json
```

## Output formats
All commands support:

```bash
--format json
--format md
```

- `json` prints structured JSON to stdout
- `md` writes a markdown report file to disk
- default output is plain CLI text

## Generating a synthetic 100 MB log
From the project root, run:

```bash
node scripts/gen_log.js --output tmp/100mb.log --target-mb 100
```

Or with the npm script:

```bash
npm run gen:log -- --output tmp/100mb.log --target-mb 100
```

This creates a synthetic log file that you can use to test performance without needing a real production log.

## Running logscope against the generated file
Examples:

```bash
logscope summary tmp/100mb.log
logscope timeline tmp/100mb.log --bucket 15m
logscope grep tmp/100mb.log --level ERROR --since "2026-10-01 09:00:00"
```

If `logscope` is not on your `PATH`, use:

```bash
npx logscope summary tmp/100mb.log
```

## Performance check
A basic runtime check for the summary command:

```bash
logscope summary tmp/100mb.log
```

When this was benchmarked in this repository, the generated 100 MB file was processed in about 7.7 seconds with peak working set around 96.7 MB.

## Sharing with other users
If someone clones this repository from GitHub, they should:

1. Install Node.js and npm
2. Run `npm install`
3. Either:
   - run commands with `npx logscope ...`, or
   - run `npm link` once to enable the `logscope` command

There is no reliable way for a GitHub download alone to auto-modify a user's `PATH` safely. The standard approach is documenting `npx`, `npm link`, or publishing the package to npm for `npm install -g`.
