#!/usr/bin/env node
/**
 * Offline validation that documentation files contain required sections,
 * cross-references, and command references for the 01e hh.ru enrichment workflow.
 *
 * Reads docs/SETUP.md and airtable/AIRTABLE-SCHEMA.md as text only.
 * Never modifies or evaluates any code.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETUP_PATH = join(__dirname, '../docs/SETUP.md');
const SCHEMA_PATH = join(__dirname, '../airtable/AIRTABLE-SCHEMA.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const errors = [];

  // Load both docs
  let setupMd;
  let schemaMd;
  try {
    setupMd = readFileSync(SETUP_PATH, 'utf8');
  } catch (err) {
    console.error('FAIL: Could not load docs/SETUP.md:', err.message);
    process.exit(1);
  }
  try {
    schemaMd = readFileSync(SCHEMA_PATH, 'utf8');
  } catch (err) {
    console.error('FAIL: Could not load airtable/AIRTABLE-SCHEMA.md:', err.message);
    process.exit(1);
  }

  try {
    // ── Check 1: SETUP.md contains "01e hh.ru Pre-flight" section ──
    assert(
      setupMd.includes('01e hh.ru Pre-flight'),
      'SETUP.md should contain "01e hh.ru Pre-flight" section heading'
    );

    // ── Check 2: SETUP.md references test_hh_vacancy_parse.mjs ──
    assert(
      setupMd.includes('test_hh_vacancy_parse.mjs'),
      'SETUP.md should reference test_hh_vacancy_parse.mjs'
    );

    // ── Check 3: AIRTABLE-SCHEMA.md contains "Troubleshooting 01e Pipeline writes" section ──
    assert(
      schemaMd.includes('Troubleshooting 01e Pipeline writes'),
      'AIRTABLE-SCHEMA.md should contain "Troubleshooting 01e Pipeline writes" section'
    );

    // ── Check 4: AIRTABLE-SCHEMA.md contains "Source shows LinkedIn" symptom ──
    assert(
      schemaMd.includes('Source shows LinkedIn'),
      'AIRTABLE-SCHEMA.md should contain "Source shows LinkedIn" symptom'
    );

    // ── Check 5: SETUP.md links to AIRTABLE-SCHEMA.md ──
    assert(
      setupMd.includes('AIRTABLE-SCHEMA.md'),
      'SETUP.md should link to AIRTABLE-SCHEMA.md'
    );

    // ── Check 6: AIRTABLE-SCHEMA.md links to SETUP.md ──
    assert(
      schemaMd.includes('SETUP.md'),
      'AIRTABLE-SCHEMA.md should link to SETUP.md'
    );
  } catch (err) {
    errors.push(err.message);
  }

  if (errors.length > 0) {
    console.error('FAIL:', errors.join('\n  - '));
    process.exit(1);
  }

  console.log('OK: hh.ru documentation presence validation passed');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
