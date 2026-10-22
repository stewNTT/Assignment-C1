# logscope Specification

## Overview
`logscope` is a command-line tool for analyzing large log files via streaming (line-by-line), without loading the full file into memory.

### Performance Target
- Handle 100MB+ log files
- Complete under 60 seconds (on typical developer machine)
- Maintain low memory overhead

## Log Format
Expected valid line format:

`YYYY-MM-DD HH:mm:ss [LEVEL] Message`

Where:
- `LEVEL` is one of: `INFO`, `WARN`, `ERROR`
- Any non-conforming line is malformed

## Commands

### 1) `logscope summary <file>`
Outputs:
- Log count by level (`INFO`, `WARN`, `ERROR`)
- Top 5 most frequent `ERROR` messages
- First valid timestamp found
- Last valid timestamp found
- Count of malformed lines

### 2) `logscope timeline <file> --bucket <15m|30m|1h>`
Outputs:
- Error counts per time bucket
- ASCII text bar chart rendering

### 3) `logscope grep <file> --level <LEVEL> --since "<TIMESTAMP>"`
Outputs:
- Original log lines matching:
  - specified log level (if provided)
  - timestamp >= `--since` (if provided)

## Global Options
Applies to all commands:
- `--format json|md`

Behavior:
- `json`: prints structured JSON to stdout
- `md`: writes a formatted markdown report file to disk
- default: prints clean human-readable CLI text to stdout

## Fault Tolerance
- Malformed lines must never crash the CLI
- Malformed lines are skipped for parsing logic
- Malformed line counter must be incremented
