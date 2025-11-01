#!/usr/bin/env node
// Fetch countries list and (optionally) download all flags locally.
// Requires Node 18+ (built-in fetch).

import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const FLAGS_DIR = path.join(ASSETS, 'flags');
const COUNTRIES_JSON = path.join(ASSETS, 'countries.json');

const FLAGCDN_BASE = 'https://flagcdn.com';
const FLAGSAPI_BASE = 'https://flagsapi.com';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { svg: false, png: false, json: true, both: false, limit: 0, noFlags: false };
  for (let i = 0; i < args.length; i++) {
    let a = args[i];
    let val = null;
    if (a.includes('=')) {
      const [k, v] = a.split('=');
      a = k; val = v;
    }
    const toBool = (x) => {
      if (x == null) return true;
      const s = String(x).toLowerCase();
      if (s === 'false' || s === '0' || s === 'no') return false;
      return Boolean(x);
    };
    if (a === '--svg') opts.svg = toBool(val);
    else if (a === '--png') opts.png = toBool(val);
    else if (a === '--both') opts.both = toBool(val);
    else if (a === '--no-flags') { opts.noFlags = true; opts.svg = false; opts.png = false; opts.both = false; }
    else if (a === '--only=json') { opts.json = true; opts.noFlags = true; opts.svg = false; opts.png = false; opts.both = false; }
    else if (a === '--no-json') opts.json = false;
    else if (a === '--json') opts.json = toBool(val);
  else if (a === '--limit') { opts.limit = Number(val ?? (args[++i] || 0)) || 0; }
  }
  if (!opts.noFlags && !opts.svg && !opts.png && !opts.both) opts.svg = true; // default to svg only
  return opts;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try { await access(p, fsConstants.F_OK); return true; } catch { return false; }
}

async function fetchCountries() {
  const url = 'https://restcountries.com/v3.1/all?fields=cca2,name,region';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch countries: ${res.status}`);
  const data = await res.json();
  const simple = data
    .map((c) => ({ code: String(c.cca2 || '').toUpperCase(), name: c.name?.common || '' }))
    .filter((c) => /^[A-Z]{2}$/.test(c.code) && c.name && c.code !== 'XK')
    .sort((a, b) => a.name.localeCompare(b.name));
  return simple;
}

async function saveCountriesJson(items) {
  await ensureDir(ASSETS);
  await writeFile(COUNTRIES_JSON, JSON.stringify(items, null, 2), 'utf8');
  console.log(`Wrote ${COUNTRIES_JSON} (${items.length} countries)`);
}

async function download(url, destPath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok && res.type !== 'opaque') {
    throw new Error(`Failed ${url} -> ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

function svgUrl(code) {
  return `${FLAGCDN_BASE}/${code.toLowerCase()}.svg`;
}

function pngUrl(code, size = 512, style = 'flat') {
  return `${FLAGSAPI_BASE}/${code}/${style}/${size}.png`;
}

async function downloadFlags(codes, { svg, png, both, limit }) {
  await ensureDir(FLAGS_DIR);
  const dlSvg = svg || both;
  const dlPng = png || both;
  const list = limit > 0 ? codes.slice(0, limit) : codes;

  let ok = 0, fail = 0;
  for (const code of list) {
    const lc = code.toLowerCase();
    if (dlSvg) {
      const out = path.join(FLAGS_DIR, `${lc}.svg`);
      if (!(await fileExists(out))) {
        try { await download(svgUrl(code), out); ok++; }
        catch (e) { fail++; console.warn('SVG fail', code, e.message); }
      }
    }
    if (dlPng) {
      const out = path.join(FLAGS_DIR, `${lc}.png`);
      if (!(await fileExists(out))) {
        try { await download(pngUrl(code), out); ok++; }
        catch (e) { fail++; console.warn('PNG fail', code, e.message); }
      }
    }
  }
  console.log(`Flags downloaded: ${ok}, failed: ${fail}`);
}

async function main() {
  const opts = parseArgs();
  const countries = await fetchCountries();
  if (opts.json) await saveCountriesJson(countries);
  const codes = countries.map((c) => c.code);
  if (!opts.noFlags && (opts.svg || opts.png || opts.both)) {
    await downloadFlags(codes, opts);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
