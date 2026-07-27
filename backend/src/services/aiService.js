// Ported from services/ai_service.py
// Evaluates coursework sections via OpenRouter free models, with a deterministic
// mock fallback so the platform keeps working without an API key.

import config from '../config.js';
import { t, DEFAULT_LANG, sectionTitle } from '../i18n/index.js';

const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
];

export const ORDERED_SECTIONS = [
  'Relevance',
  'Study of the problem',
  'Main part',
  'Mathematical model',
  'Solution algorithm',
  'Flowchart',
  'Result of the created program',
  'Conclusion',
  'List of references',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOpenRouter(messages) {
  if (!config.openRouterApiKey) return 'MOCK_FALLBACK';

  const headers = {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': config.siteUrl,
    'X-Title': config.siteName,
  };

  for (const model of FALLBACK_MODELS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 200) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
      // Only retry other models on rate-limit / server errors
      if (![429, 500, 502, 503, 504].includes(res.status)) return null;
      await sleep(1000);
    } catch (e) {
      // network/abort — try the next model
      continue;
    }
  }
  return 'MOCK_FALLBACK';
}

function mockEvaluate(sectionName, content = '', lang = DEFAULT_LANG) {
  const clean = (content || '').replace('[Image uploaded]', '').trim();
  const len = clean.length;
  let score;
  let key;

  if (len < 10 && !['Flowchart', 'Result of the created program'].includes(sectionName)) {
    score = 0;
    key = 'ai.sectionEmpty';
  } else if (len < 100) {
    score = 30;
    key = 'ai.tooShort';
  } else if (len < 300) {
    score = 55;
    key = 'ai.basicDescription';
  } else {
    score = 65;
    key = 'ai.contentNoAnalysis';
  }

  if ((content || '').includes('[Image uploaded]')) {
    score = 75;
    key = 'ai.imageReceived';
  }

  return { score, feedback: `[System Fallback] ${t(lang, key)}` };
}

function commentForScore(score, lang) {
  const s = Number(score) || 0;
  if (s >= 85) return t(lang, 'ai.strongSection');
  if (s >= 70) return t(lang, 'ai.goodSection');
  if (s >= 50) return t(lang, 'ai.satisfactory');
  return t(lang, 'ai.weakSection');
}

export function buildOverallFeedbackFallback(scoresDict, totalScore, isMock = false, lang = DEFAULT_LANG) {
  const safe = {};
  for (const k of ORDERED_SECTIONS) safe[k] = Number(scoresDict[k] || 0) || 0;

  const ranked = Object.entries(safe).sort((a, b) => a[1] - b[1]);
  const names = (entries) => entries.map(([n]) => sectionTitle(lang, n)).join(', ');
  const weakest = names(ranked.slice(0, 3));
  const strongest = names(ranked.slice(-3));
  const scoreInt = Math.round(Number(totalScore || 0));
  const prefix = isMock ? '[Mock AI] ' : '';

  const summary = prefix + t(lang, 'ai.summary', { score: scoreInt, strongest, weakest });
  const c1 = prefix + t(lang, 'ai.pros', { strongest });
  const c2 = prefix + t(lang, 'ai.growth', { weakest });

  const lines = [
    `Summary: ${summary}`,
    `Comment 1: ${c1}`,
    `Comment 2: ${c2}`,
    t(lang, 'ai.perPointHeader'),
  ];
  ORDERED_SECTIONS.forEach((sec, idx) => {
    const v = Math.round(safe[sec] || 0);
    lines.push(`${idx + 1}) ${sectionTitle(lang, sec)}: ${v}/100 — ${commentForScore(v, lang)}`);
  });
  return lines.join('\n');
}

export async function evaluateSection(sectionName, content, fileContent = null, lang = DEFAULT_LANG) {
  const hasImage = (content || '').includes('[Image uploaded]');
  const clean = (content || '').replace('[Image uploaded]', '').trim();

  // A diagram submitted as an image with no accompanying text cannot be judged
  // by a text-only model — grade it neutrally instead of scoring the empty
  // string the model would otherwise receive.
  if (hasImage && clean.length < 20)
    return { score: 70, feedback: t(lang, 'ai.imageReceived') };

  // Only genuinely empty answers are short-circuited. Everything else goes to
  // the model: a concise but correct answer must not be capped by its length.
  if (!['Flowchart', 'Result of the created program'].includes(sectionName) && clean.length < 20)
    return { score: 5, feedback: t(lang, 'ai.almostEmpty') };

  const fileCtx = fileContent ? fileContent.slice(0, 3000) : t(lang, 'ai.noFileContext');

  // The prompt lives in the locale files so the model answers in the student's language.
  const prompt = t(lang, 'prompt.evaluateSection', {
    sectionName,
    content: clean.slice(0, 4000),
    fileCtx,
  });

  const responseText = await callOpenRouter([{ role: 'user', content: prompt }]);
  if (!responseText || responseText === 'MOCK_FALLBACK') return mockEvaluate(sectionName, content, lang);

  try {
    let text = responseText.trim();
    if (text.includes('```json')) text = text.split('```json')[1].split('```')[0];
    else if (text.includes('```')) text = text.split('```')[1].split('```')[0];
    else if (text.includes('{') && text.includes('}'))
      text = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);

    const result = JSON.parse(text);
    let score = Number(result.score || 0);
    score = Math.max(0, Math.min(100, score));
    return { score, feedback: result.feedback || t(lang, 'ai.noComment') };
  } catch (e) {
    return mockEvaluate(sectionName, content, lang);
  }
}

export async function generateOverallFeedback(scoresDict, totalScore, lang = DEFAULT_LANG) {
  const perPointHeader = t(lang, 'ai.perPointHeader');
  const prompt = t(lang, 'prompt.overallFeedback', {
    scores: JSON.stringify(scoresDict, null, 2),
    totalScore: totalScore.toFixed(1),
    perPointHeader,
  });

  const responseText = await callOpenRouter([{ role: 'user', content: prompt }]);
  if (!responseText || responseText === 'MOCK_FALLBACK')
    return buildOverallFeedbackFallback(scoresDict, totalScore, true, lang);

  try {
    let text = responseText.trim().replace(/^\s*```\s*/, '').replace(/\s*```\s*$/, '');
    if (!text.includes('Summary:') || !text.includes('Comment 1:') || !text.includes('Comment 2:'))
      return buildOverallFeedbackFallback(scoresDict, totalScore, false, lang);

    const scoreInt = Math.round(Number(totalScore || 0));
    let summaryPart = '';
    try {
      summaryPart = text.split('Summary:')[1].split('Comment 1:')[0].trim();
    } catch (e) {
      summaryPart = '';
    }
    if (!summaryPart.includes(String(scoreInt))) {
      const justification = t(lang, 'ai.scoreJustification', { score: scoreInt });
      text = text.replace('Summary:', `Summary: ${justification}`);
    }
    if (!text.includes(perPointHeader))
      return buildOverallFeedbackFallback(scoresDict, totalScore, false, lang);
    return text;
  } catch (e) {
    return buildOverallFeedbackFallback(scoresDict, totalScore, false, lang);
  }
}
