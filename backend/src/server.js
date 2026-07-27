import { createApp } from './app.js';
import config from './config.js';
import prisma from './lib/prisma.js';

const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n=== Independent Work Evaluation-AI API ===`);
  console.log(`Listening on http://0.0.0.0:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  // Report the engine that actually grades, in priority order, with its settings
  // so the log reflects the real accuracy configuration at a glance.
  let engine;
  let quotaNote = null;
  if (config.geminiApiKey) {
    // Spelled out because it is the number that decides whether a free API key
    // survives a day of submissions: every sample is one call, and the verify
    // pass adds one more. Past the quota, grading falls back to a mock that
    // scores by text length — silently, unless someone reads the logs.
    const callsPerSubmission = config.geminiSamples + (config.geminiVerify ? 1 : 0);
    const extras = [`samples=${config.geminiSamples}`, `verify=${config.geminiVerify ? 'on' : 'off'}`];
    engine = `Gemini (${config.geminiModel}) · ${extras.join(' · ')} · ${callsPerSubmission} API call(s)/submission`;
    if (callsPerSubmission > 1)
      quotaNote =
        `  note: ${callsPerSubmission} calls per submission — on a free API key set GEMINI_SAMPLES=1`;
  } else if (config.openRouterApiKey) {
    engine = 'OpenRouter';
  } else {
    engine = 'Mock fallback';
  }
  console.log(`AI grading: ${engine}`);
  if (quotaNote) console.log(quotaNote);
  if (config.kbEnabled) console.log(`Knowledge base: on (${config.kbDir})`);
  if (config.plagEnabled) {
    const ai = config.plagAi && config.plagAiCandidates > 0 && config.geminiApiKey ? 'AI verified' : 'fingerprint only';
    console.log(
      `Plagiarism check: on (${ai}) · warn ≥${config.plagWarnAt}% · penalty ≥${config.plagPenaltyFrom}%`
    );
  }
  console.log(`========================\n`);
});

// Background work (grading, the originality check) runs detached from the
// request that started it, so a rejection there has no `next()` to fall into.
// Requests are already covered by lib/asyncRouter.js; this is the net under
// everything else, and it must not kill the server — a failed grading is one
// bad submission, not a reason to drop every other user's session.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (server kept running):', reason);
});

// An uncaught exception is different: the process may be in an unknown state,
// so the honest response is to die and let the host start a clean one.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — shutting down:', err);
  shutdown(1);
});

async function shutdown(code = 0) {
  console.log('Shutting down...');
  // Stop taking new connections, but let in-flight requests finish — a student
  // mid-upload should not lose their submission to a routine redeploy.
  const closed = new Promise((resolve) => server.close(resolve));
  const timeout = new Promise((resolve) => setTimeout(resolve, 10000).unref());
  await Promise.race([closed, timeout]);
  await prisma.$disconnect().catch(() => {});
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
