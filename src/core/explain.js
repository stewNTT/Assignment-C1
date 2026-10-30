const { summarizeFile } = require('./summary');

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_TOKENS = 2000;

function getExplainConfig(env = process.env) {
  const endpoint = env.LOGSCOPE_LLM_ENDPOINT;
  const apiKey = env.LOGSCOPE_LLM_API_KEY || null;
  const model = env.LOGSCOPE_LLM_MODEL || null;
  const timeoutMs = env.LOGSCOPE_LLM_TIMEOUT_MS
    ? Number(env.LOGSCOPE_LLM_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
  const maxTokens = env.LOGSCOPE_LLM_MAX_TOKENS
    ? Number(env.LOGSCOPE_LLM_MAX_TOKENS)
    : DEFAULT_MAX_TOKENS;

  if (!endpoint) {
    throw new Error('LOGSCOPE_LLM_ENDPOINT is required for explain');
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('LOGSCOPE_LLM_TIMEOUT_MS must be a positive number');
  }

  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new Error('LOGSCOPE_LLM_MAX_TOKENS must be a positive number');
  }

  return {
    endpoint,
    apiKey,
    model,
    timeoutMs,
    maxTokens,
  };
}

function buildExplainPrompt(summary) {
  const topErrors = summary.topErrors.length === 0
    ? '- none'
    : summary.topErrors
      .map((item, index) => `- ${index + 1}. ${item.message} (${item.count})`)
      .join('\n');

  return [
    'You are analyzing application logs after an incident.',
    'Provide a probable root-cause summary in plain text.',
    'Keep the answer concise and action-oriented.',
    '',
    'Log summary:',
    `INFO count: ${summary.levels.INFO}`,
    `WARN count: ${summary.levels.WARN}`,
    `ERROR count: ${summary.levels.ERROR}`,
    `First timestamp: ${summary.firstTimestamp || 'n/a'}`,
    `Last timestamp: ${summary.lastTimestamp || 'n/a'}`,
    `Malformed lines: ${summary.malformedLines}`,
    'Top error messages:',
    topErrors,
  ].join('\n');
}

function detectProvider(config) {
  if (typeof config.endpoint === 'string' && config.endpoint.includes('api.anthropic.com')) {
    return 'anthropic';
  }

  return 'generic';
}

function buildExplainRequestBody(summary, config) {
  const prompt = buildExplainPrompt(summary);

  if (detectProvider(config) === 'anthropic') {
    return {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };
  }

  return {
    model: config.model,
    input: {
      summary,
      prompt,
    },
  };
}

async function parseExplainResponse(response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Explain request failed with ${response.status}: ${text}`);
  }

  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    return text.trim();
  }

  if (typeof payload.summary === 'string' && payload.summary.trim()) {
    return payload.summary.trim();
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.choices)) {
    const content = payload.choices[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }
  }

  if (Array.isArray(payload.content)) {
    const textParts = payload.content
      .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text.trim())
      .filter(Boolean);

    if (textParts.length > 0) {
      return textParts.join('\n\n');
    }
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  throw new Error('Explain response did not include a usable summary');
}

async function requestExplanation(summary, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is not available in this Node.js runtime');
  }

  const config = getExplainConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers = {
      'content-type': 'application/json',
    };

    if (detectProvider(config) === 'anthropic') {
      headers['anthropic-version'] = '2023-06-01';

      if (config.apiKey) {
        headers['x-api-key'] = config.apiKey;
      }
    } else if (config.apiKey) {
      headers.authorization = `Bearer ${config.apiKey}`;
    }

    const response = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildExplainRequestBody(summary, config)),
      signal: controller.signal,
    });

    const explanation = await parseExplainResponse(response);

    return {
      explanation,
      endpoint: config.endpoint,
      model: config.model,
    };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Explain request timed out after ${config.timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function explainFile(filePath, options = {}) {
  const summary = await summarizeFile(filePath);
  const result = await requestExplanation(summary, options);

  return {
    summary,
    explanation: result.explanation,
    endpoint: result.endpoint,
    model: result.model,
  };
}

module.exports = {
  buildExplainPrompt,
  buildExplainRequestBody,
  detectProvider,
  explainFile,
  getExplainConfig,
  parseExplainResponse,
  requestExplanation,
};
