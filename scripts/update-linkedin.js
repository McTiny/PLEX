// update-linkedin.js
// Scrapes LinkedIn analytics, regenerates linkedin.html, deploys to Netlify.
// First run: node update-linkedin.js --setup  (headful, log in once)
// Weekly:    node update-linkedin.js           (headless, via Task Scheduler)

'use strict';

process.on('uncaughtException', err => {
  const clean = err.stack.replace(/sk-ant-[A-Za-z0-9\-_]+/g, '[REDACTED]');
  console.error(`[FATAL] ${clean}`);
  process.exit(1);
});

const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT         = path.resolve(__dirname, '..');
const HTML_FILE    = path.join(ROOT, 'site', 'linkedin.html');
const PROFILE_DIR  = path.join(__dirname, 'linkedin-profile');
const LOG_FILE     = path.join(__dirname, 'logs', `${today()}.log`);

// ── Config ─────────────────────────────────────────────────────────────────
const SETUP_MODE   = process.argv.includes('--setup');
const MODEL        = 'claude-sonnet-4-6';

const PAGES = [
  { key: 'overview', url: 'https://www.linkedin.com/dashboard/' },
  { key: 'viewers',  url: 'https://www.linkedin.com/analytics/profile-views/' },
  { key: 'content',  url: 'https://www.linkedin.com/analytics/creator/content/' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

function log(msg) {
  // Scrub any API keys from log output
  const clean = msg.replace(/sk-ant-[A-Za-z0-9\-_]+/g, '[REDACTED]');
  const line = `[${new Date().toISOString()}] ${clean}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function die(msg) {
  log(`FATAL: ${msg}`);
  process.exit(1);
}

// ── Scrape ─────────────────────────────────────────────────────────────────
async function scrape() {
  log(`Launching browser (setup=${SETUP_MODE}, profile=${PROFILE_DIR})`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !SETUP_MODE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  const results = {};

  for (const { key, url } of PAGES) {
    log(`Fetching ${key}: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // LinkedIn can be slow — wait for meaningful content
      await page.waitForTimeout(4000);

      // For viewers page: scroll to expose all Interesting Viewers
      if (key === 'viewers') {
        log('Scrolling to load all Interesting Viewers...');
        for (let i = 0; i < 8; i++) {
          await page.evaluate(() => window.scrollBy(0, 600));
          await page.waitForTimeout(800);
        }
        await page.waitForTimeout(1000);
      }

      results[key] = await page.evaluate(() => document.body.innerText);
      log(`${key}: ${results[key].length} chars`);

      // Detect login wall
      if (results[key].includes('Sign in') && results[key].length < 500) {
        die(`LinkedIn login required. Run with --setup flag first.`);
      }
    } catch (err) {
      log(`ERROR on ${key}: ${err.message}`);
      results[key] = '';
    }
  }

  await context.close();
  return results;
}

// ── Parse + Regenerate HTML ────────────────────────────────────────────────
async function regenerateHTML(scraped) {
  if (!process.env.ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY not set.');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const currentHTML = fs.readFileSync(HTML_FILE, 'utf8');

  log('Calling Claude to parse data and regenerate HTML...');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Update this LinkedIn analytics dashboard HTML with fresh data. 
Preserve ALL styling, CSS, password gate, and structure exactly.
Update only: metrics, dates, percentages, Interesting Viewers table, insights section.
Tag viewers: NEW=first appearance, RECRUITER=recruiting role, RCDD=credentialed peer, EXANTE=Exante360 colleague.
Today: ${today()}. Return ONLY complete HTML, no explanation.

CURRENT HTML (preserve structure/style):
${currentHTML}

OVERVIEW:
${scraped.overview.slice(0, 1500)}

VIEWERS:
${scraped.viewers.slice(0, 3000)}

CONTENT:
${scraped.content.slice(0, 1500)}`
    }]
  });

  const newHTML = response.content[0].text.trim();

  // Sanity check — must look like HTML
  if (!newHTML.startsWith('<!DOCTYPE') && !newHTML.startsWith('<html')) {
    die('Claude did not return valid HTML. Aborting to protect existing file.');
  }

  return newHTML;
}

// ── Deploy ─────────────────────────────────────────────────────────────────
function deploy() {
  log('Deploying to Netlify...');
  try {
    const out = execSync('netlify deploy --dir site --prod', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 120000,
    });
    log('Deploy output: ' + out.slice(0, 500));
  } catch (err) {
    log(`Deploy error: ${err.message}`);
  }
}

// ── Setup (first-run login) ────────────────────────────────────────────────
async function setup() {
  log('Setup mode: opening LinkedIn login. Log in, then press Enter here to finish.');
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('https://www.linkedin.com/login');
  
  // Wait for Enter key in terminal
  process.stdout.write('\n>>> Browser is open. Log into LinkedIn, then press Enter here to save session and exit...\n');
  await new Promise(resolve => process.stdin.once('data', resolve));
  
  await context.close();
  log('Session saved. Run without --setup for weekly updates.');
  process.exit(0);
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  log('=== LinkedIn update started ===');

  if (SETUP_MODE) return setup();

  const scraped = await scrape();

  const hasData = Object.values(scraped).some(v => v.length > 200);
  if (!hasData) die('All pages returned empty. Aborting.');

  const newHTML = await regenerateHTML(scraped);

  // Backup existing file
  const backup = HTML_FILE.replace('.html', `.bak.${today()}.html`);
  fs.copyFileSync(HTML_FILE, backup);
  log(`Backed up to ${backup}`);

  fs.writeFileSync(HTML_FILE, newHTML, 'utf8');
  log('linkedin.html updated.');

  deploy();

  log('=== LinkedIn update complete ===');
})();
