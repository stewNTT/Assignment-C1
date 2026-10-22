# Agent Instructions (logscope)

## Workflow
- Follow Spec-Driven Development.
- Do not implement all modules at once.
- Implement in approved order only:
  1. Parser
  2. Summary
  3. Timeline
  4. Grep
  5. Output Formats (JSON/Markdown)
  6. Performance script

## Testing Discipline
- After each module, add/update unit tests.
- Run tests immediately after each change.
- Do not proceed to next module until tests pass and user approves.

## Performance & Memory
- Stream file line-by-line.
- Never load full file into memory.
- Keep parser resilient to malformed lines.

## Robustness
- Malformed lines must never crash execution.
- Always count malformed lines where relevant (especially summary).

## Output Modes
- Default: human-readable stdout.
- `--format json`: structured JSON to stdout.
- `--format md`: write markdown report file.

## Collaboration Rules
- Provide modular progress summaries before moving ahead.
- Wait for user approval between stages.
