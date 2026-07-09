#!/usr/bin/env node
/**
 * kb-lint — guard rel KB Fourfect/COPUX sebelum commit.
 *
 * Cek:
 *   [ERROR] 00-index.md nyebut file yang GA ADA di disk        -> exit 1
 *   [ERROR] file .md di disk yang GA disebut 00-index.md       -> exit 1
 *   [WARN]  file pake [VERIFIED] tapi 0 atribusi sumber        -> tetep exit 0
 *   [INFO]  rekap jumlah tag confidence per file
 *
 * Dasar: CONTENT-DISCIPLINE.md — VERIFIED harus bisa nunjuk sumber.
 * Pemakaian: node scripts/kb-lint.js   (dari root /root/Bot-Telegram)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, '..', 'data', 'kb');
const INDEX = '00-index.md';

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function read(file) {
  return fs.readFileSync(path.join(KB_DIR, file), 'utf8');
}

// Atribusi (di-cek per-FILE, bukan per-baris): kualifier dalam bracket
// (`[VERIFIED — ...]`/`via`/tanggal), ATAU dash tepat setelah bracket
// (`[VERIFIED]** — dari...`), ATAU pernyataan sumber prosa (`Sumber:`,
// observasi/ditest/screenshot/GitHub releases).
const ATTRIB_RE = new RegExp(
  [
    '\\[VERIFIED\\s*[—-]\\s*\\S',                 // [VERIFIED — x]
    '\\[VERIFIED\\s+(via|konsep|level|nama|released|screenshot|test|ketes)\\b',
    '\\[VERIFIED\\s*,\\s*\\S',                    // [VERIFIED, x]
    '\\[VERIFIED\\]\\**\\s*[—-]',                 // [VERIFIED]** — ...
    '(?:^|\\n)\\s*>?\\s*Sumber\\s*:',             // baris "Sumber:"
    '\\b(observasi|ditest|di-?test|ke-?test|ketes|screenshot UI|GitHub releases)\\b',
  ].join('|'),
  'i'
);
// Bare [VERIFIED] sebagai KLAIM (bukan nyebut nama tag, mis. "ke [VERIFIED]").
const BARE_VERIFIED_RE = /(?<!\b(?:ke|jadi|naik\w*|confidence|tag)\s)\[VERIFIED\]/i;
const TAG_RE = /\[(VERIFIED|THEORETICAL|REVEALED PREFERENCE|REVEALED)[^\]]*\]/g;

function main() {
  if (!fs.existsSync(KB_DIR)) {
    console.error(C.red(`FATAL: KB dir ga ada: ${KB_DIR}`));
    process.exit(2);
  }

  const errors = [];
  const warns = [];

  const disk = fs
    .readdirSync(KB_DIR)
    .filter((f) => f.endsWith('.md') && f !== INDEX)
    .sort();

  // --- index vs disk ---
  let referenced = [];
  if (!fs.existsSync(path.join(KB_DIR, INDEX))) {
    errors.push(`${INDEX} ga ada — index hilang.`);
  } else {
    const idxText = read(INDEX);
    referenced = [...new Set((idxText.match(/[a-z0-9][a-z0-9-_]*\.md/gi) || []))]
      .filter((f) => f !== INDEX);
    for (const ref of referenced) {
      if (!disk.includes(ref)) {
        errors.push(`${INDEX} nyebut "${ref}" tapi file-nya GA ADA di disk.`);
      }
    }
    for (const f of disk) {
      if (!referenced.includes(f)) {
        errors.push(`"${f}" ada di disk tapi GA disebut ${INDEX}.`);
      }
    }
  }

  // --- tag confidence per file ---
  const tally = [];
  for (const f of disk) {
    const text = read(f);
    const lines = text.split('\n');
    let v = 0, t = 0, r = 0;
    const hasAttrib = ATTRIB_RE.test(text); // atribusi di-cek level-file
    const bareLines = [];
    lines.forEach((ln, i) => {
      const tags = ln.match(TAG_RE);
      if (!tags) return;
      for (const tag of tags) {
        if (/^\[VERIFIED/.test(tag)) v++;
        else if (/^\[THEORETICAL/.test(tag)) t++;
        else r++;
      }
      if (BARE_VERIFIED_RE.test(ln)) bareLines.push(i + 1);
    });
    tally.push({ f, v, t, r, hasAttrib, bareCount: bareLines.length });
    if (v > 0 && !hasAttrib) {
      warns.push(
        `${f}: ${v}× [VERIFIED] tapi 0 atribusi sumber di file ini ` +
        `(baris bare: ${bareLines.slice(0, 8).join(', ')}${bareLines.length > 8 ? '…' : ''}).`
      );
    }
  }

  // --- report ---
  console.log(C.dim(`kb-lint · ${disk.length} file · ${referenced.length} ref di index\n`));

  if (errors.length) {
    console.log(C.red(`ERROR (${errors.length}):`));
    errors.forEach((e) => console.log('  ' + C.red('✗') + ' ' + e));
    console.log('');
  }
  if (warns.length) {
    console.log(C.yellow(`WARN (${warns.length}):`));
    warns.forEach((w) => console.log('  ' + C.yellow('!') + ' ' + w));
    console.log('');
  }

  console.log(C.dim('tag confidence per file:'));
  tally
    .filter((x) => x.v || x.t || x.r)
    .sort((a, b) => b.v - a.v)
    .forEach((x) => {
      console.log(
        '  ' + x.f.padEnd(38) +
        C.green(`V:${x.v}`) + '  ' +
        C.yellow(`T:${x.t}`) + '  ' +
        `R:${x.r}` +
        (x.v && !x.hasAttrib ? '  ' + C.yellow('← no-attrib') : '')
      );
    });

  console.log('');
  if (errors.length) {
    console.log(C.red(`FAIL — ${errors.length} error. Benerin sebelum commit.`));
    process.exit(1);
  }
  console.log(C.green(`OK — index konsisten.`) + (warns.length ? C.yellow(` (${warns.length} warn, cek manual)`) : ''));
  process.exit(0);
}

main();
