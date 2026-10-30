const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildExplainPrompt,
  buildExplainRequestBody,
  detectProvider,
  explainFile,
  getExplainConfig,
  parseExplainResponse,
  requestExplanation,
} = require('../src/core/explain');

test('getExplainConfig reads endpoint configuration from environment', () => {
  const config = getExplainConfig({
    LOGSCOPE_LLM_ENDPOINT: 'https://example.test/explain',
    LOGSCOPE_LLM_API_KEY: 'secret',
    LOGSCOPE_LLM_MODEL: 'demo-model',
    LOGSCOPE_LLM_TIMEOUT_MS: '2500',
  });

  assert.deepEqual(config, {
    endpoint: 'https://example.test/explain',
    apiKey: 'secret',
    model: 'demo-model',
    timeoutMs: 2500,
    maxTokens: 2000,
  });
});

test('buildExplainPrompt includes summary details and top errors', () => {
  const prompt = buildExplainPrompt({
    levels: { INFO: 3, WARN: 1, ERROR: 2 },
    malformedLines: 4,
    firstTimestamp: '2026-10-22T10:00:00.000Z',
    lastTimestamp: '2026-10-22T10:15:00.000Z',
    topErrors: [
      { message: 'Timeout', count: 2 },
    ],
  });

  assert.match(prompt, /ERROR count: 2/);
  assert.match(prompt, /Malformed lines: 4/);
  assert.match(prompt, /1\. Timeout \(2\)/);
});

test('detectProvider recognizes anthropic endpoints', () => {
  assert.equal(detectProvider({ endpoint: 'https://api.anthropic.com/v1/messages' }), 'anthropic');
  assert.equal(detectProvider({ endpoint: 'https://example.test/explain' }), 'generic');
});

test('buildExplainRequestBody packages generic model and prompt', () => {
  const body = buildExplainRequestBody({
    levels: { INFO: 0, WARN: 0, ERROR: 1 },
    malformedLines: 0,
    firstTimestamp: null,
    lastTimestamp: null,
    topErrors: [{ message: 'Disk full', count: 1 }],
  }, {
    model: 'demo-model',
    endpoint: 'https://example.test/explain',
  });

  assert.equal(body.model, 'demo-model');
  assert.match(body.input.prompt, /Disk full/);
});

test('buildExplainRequestBody packages anthropic messages payload', () => {
  const body = buildExplainRequestBody({
    levels: { INFO: 0, WARN: 0, ERROR: 1 },
    malformedLines: 0,
    firstTimestamp: null,
    lastTimestamp: null,
    topErrors: [{ message: 'Disk full', count: 1 }],
  }, {
    model: 'claude-sonnet-4-5',
    endpoint: 'https://api.anthropic.com/v1/messages',
    maxTokens: 2000,
  });

  assert.equal(body.model, 'claude-sonnet-4-5');
  assert.equal(body.max_tokens, 2000);
  assert.equal(body.messages[0].role, 'user');
  assert.match(body.messages[0].content, /Disk full/);
});

test('parseExplainResponse extracts summary from json payloads', async () => {
  const summary = await parseExplainResponse({
    ok: true,
    text: async () => JSON.stringify({ summary: 'Database pool exhaustion.' }),
  });

  assert.equal(summary, 'Database pool exhaustion.');
});

test('requestExplanation posts prompt and parses response', async () => {
  const calls = [];
  const result = await requestExplanation({
    levels: { INFO: 1, WARN: 0, ERROR: 2 },
    malformedLines: 1,
    firstTimestamp: '2026-10-22T10:00:00.000Z',
    lastTimestamp: '2026-10-22T10:10:00.000Z',
    topErrors: [{ message: 'Timeout', count: 2 }],
  }, {
    env: {
      LOGSCOPE_LLM_ENDPOINT: 'https://example.test/explain',
      LOGSCOPE_LLM_API_KEY: 'token',
      LOGSCOPE_LLM_MODEL: 'demo-model',
      LOGSCOPE_LLM_TIMEOUT_MS: '5000',
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        text: async () => JSON.stringify({ summary: 'Likely database saturation.' }),
      };
    },
  });

  assert.equal(result.explanation, 'Likely database saturation.');
  assert.equal(result.endpoint, 'https://example.test/explain');
  assert.equal(result.model, 'demo-model');
  assert.equal(calls[0].url, 'https://example.test/explain');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer token');
});

test('requestExplanation sends anthropic headers and payload', async () => {
  const calls = [];
  const result = await requestExplanation({
    levels: { INFO: 0, WARN: 1, ERROR: 2 },
    malformedLines: 0,
    firstTimestamp: '2026-10-22T10:00:00.000Z',
    lastTimestamp: '2026-10-22T10:10:00.000Z',
    topErrors: [{ message: 'Timeout', count: 2 }],
  }, {
    env: {
      LOGSCOPE_LLM_ENDPOINT: 'https://api.anthropic.com/v1/messages',
      LOGSCOPE_LLM_API_KEY: 'anthropic-token',
      LOGSCOPE_LLM_MODEL: 'claude-sonnet-4-5',
      LOGSCOPE_LLM_TIMEOUT_MS: '5000',
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        text: async () => JSON.stringify({
          content: [
            { type: 'text', text: 'Probable downstream timeout saturation.' },
          ],
        }),
      };
    },
  });

  assert.equal(result.explanation, 'Probable downstream timeout saturation.');
  assert.equal(calls[0].options.headers['anthropic-version'], '2023-06-01');
  assert.equal(calls[0].options.headers['x-api-key'], 'anthropic-token');
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.model, 'claude-sonnet-4-5');
  assert.equal(payload.max_tokens, 2000);
  assert.equal(payload.messages[0].role, 'user');
});

test('explainFile reuses summary output and returns explanation details', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logscope-explain-'));
  const filePath = path.join(tempDir, 'app.log');

  fs.writeFileSync(filePath, [
    '2026-10-22 09:00:00 [INFO] Boot',
    '2026-10-22 09:05:00 [ERROR] Timeout',
    '2026-10-22 09:06:00 [ERROR] Timeout',
    'bad line',
  ].join('\n'), 'utf8');

  const result = await explainFile(filePath, {
    env: {
      LOGSCOPE_LLM_ENDPOINT: 'https://example.test/explain',
      LOGSCOPE_LLM_MODEL: 'demo-model',
    },
    fetchImpl: async () => ({
      ok: true,
      text: async () => JSON.stringify({ summary: 'Timeouts point to a failing downstream dependency.' }),
    }),
  });

  assert.equal(result.explanation, 'Timeouts point to a failing downstream dependency.');
  assert.equal(result.summary.levels.ERROR, 2);
  assert.equal(result.summary.malformedLines, 1);
});
