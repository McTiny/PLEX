// update-analytics.js
// Pulls Netlify analytics via API, regenerates analytics.html, deploys.
// Weekly: node update-analytics.js (via Task Scheduler)

'use strict';

process.on('uncaughtException', err => {
  const clean = (err.stack || err.message).replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
  console.error(`[FATAL] ${clean}`);
  process.exit(1);
});

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ─────────────────────────────────────────────────────────────────
const SITE_ID   = 'ed2f9096-6254-41af-8d01-6a1c144c5eb2';
const ROOT      = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'site', 'analytics.html');
const LOG_FILE  = path.join(__dirname, 'logs', `${today()}.log`);
const MODEL     = 'claude-sonnet-4-6';
const API_BASE  = 'https://api.netlify.com/api/v1';

// ── Helpers ─────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function die(msg) { log(`FATAL: ${msg}`); process.exit(1); }

async function netlifyGet(endpoint) {
  const token = process.env.NETLIFY_TOKEN;
  if (!token) die('NETLIFY_TOKEN not set.');
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Netlify API ${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

// ── 7-day window ────────────────────────────────────────────────────────────
function getWindow() {
  const to   = new Date();
  const from = new Date(to - 7 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
    fromTs: Math.floor(from.getTime() / 1000),
    toTs:   Math.floor(to.getTime()   / 1000),
  };
}

// ── Fetch Netlify data ──────────────────────────────────────────────────────
async function fetchAnalytics() {
  log('Fetching Netlify site info...');
  const site = await netlifyGet(`/sites/${SITE_ID}`);
  log(`Site: ${site.name} · ${site.url}`);

  log('Fetching deploy history...');
  const deploys = await netlifyGet(`/sites/${SITE_ID}/deploys?per_page=5`);
  const lastDeploy = deploys[0];

  const win = getWindow();
  log(`Analytics window: ${win.from} → ${win.to}`);

  // Netlify analytics endpoints
  const analyticsBase = `https://analytics.services.netlify.com/v2/${site.account_slug}/sites/${SITE_ID}`;
  const params = `from=${win.fromTs}&to=${win.toTs}&timezone=America%2FChicago`;

  let pageviews = null, visitors = null, sources = null, pages = null, notFound = null;

  try {
    pageviews = await netlifyGet(`${analyticsBase}/pageviews?${params}`);
    log(`Pageviews data: ${JSON.stringify(pageviews).slice(0, 100)}`);
  } catch(e) { log(`Pageviews unavailable: ${e.message}`); }

  try {
    visitors = await netlifyGet(`${analyticsBase}/visitors?${params}`);
    log(`Visitors data: ${JSON.stringify(visitors).slice(0, 100)}`);
  } catch(e) { log(`Visitors unavailable: ${e.message}`); }

  try {
    sources = await netlifyGet(`${analyticsBase}/sources?${params}&limit=10`);
    log(`Sources: ${JSON.stringify(sources).slice(0, 100)}`);
  } catch(e) { log(`Sources unavailable: ${e.message}`); }

  try {
    pages = await netlifyGet(`${analyticsBase}/pages?${params}&limit=10`);
    log(`Pages: ${JSON.stringify(pages).slice(0, 100)}`);
  } catch(e) { log(`Pages unavailable: ${e.message}`); }

  try {
    notFound = await netlifyGet(`${analyticsBase}/not_found?${params}&limit=10`);
    log(`Not found: ${JSON.stringify(notFound).slice(0, 100)}`);
  } catch(e) { log(`Not-found unavailable: ${e.message}`); }

  return {
    site,
    lastDeploy,
    window: win,
    pageviews,
    visitors,
    sources,
    pages,
    notFound,
  };
}

// ── Regenerate HTML ─────────────────────────────────────────────────────────
async function regenerateHTML(data) {
  if (!process.env.ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY not set.');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const currentHTML = fs.readFileSync(HTML_FILE, 'utf8');

  log('Calling Claude to regenerate analytics.html...');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Update this Netlify analytics dashboard HTML with fresh data.
Preserve ALL styling, CSS, password gate, nav, and structure exactly.
Update all metrics, dates, charts, tables with the new data below.
Today: ${today()}. Window: ${data.window.from} to ${data.window.to}.
Return ONLY complete HTML, no explanation, no markdown fences.

CURRENT HTML:
${currentHTML}

FRESH NETLIFY DATA (JSON):
${JSON.stringify(data, null, 2).slice(0, 6000)}`
    }]
  });

  const newHTML = response.content[0].text.trim();
  if (!newHTML.startsWith('<!DOCTYPE') && !newHTML.startsWith('<html')) {
    die('Claude did not return valid HTML. Aborting.');
  }
  return newHTML;
}

// ── Deploy ──────────────────────────────────────────────────────────────────
function deploy() {
  log('Deploying to Netlify...');
  try {
    const out = execSync('netlify deploy --dir site --prod', {
      cwd: ROOT, encoding: 'utf8', timeout: 120000
    });
    log('Deploy output: ' + out.slice(0, 300));
  } catch(e) { log(`Deploy error: ${e.message}`); }
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  log('=== Netlify analytics update started ===');

  const data = await fetchAnalytics();
  const newHTML = await regenerateHTML(data);

  const backup = HTML_FILE.replace('.html', `.bak.${today()}.html`);
  fs.copyFileSync(HTML_FILE, backup);
  log(`Backed up to ${backup}`);

  fs.writeFileSync(HTML_FILE, newHTML, 'utf8');
  log('analytics.html updated.');

  deploy();
  log('=== Netlify analytics update complete ===');
})();
