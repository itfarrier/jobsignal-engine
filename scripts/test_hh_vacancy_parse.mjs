#!/usr/bin/env node
/**
 * Offline unit tests for hh.ru vacancy page description extraction.
 * Mirrors extractVacancyDescriptionHtml + stripHtml + mergeVacancyDescription
 * for port into workflows/01e-scanner-hhru.json Merge Descriptions node.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '../fixtures/hh-vacancy-page-sample.html');

const TRUNCATION_SUFFIX = '\n\n[Description truncated]';
const MAX_DESCRIPTION_LENGTH = 50000;

// RED stubs — throw or return empty until Task 2 implements
export const extractVacancyDescriptionHtml = (_rawHtml) => {
  return '';
};

export const stripHtml = (_html) => {
  return '';
};

export const mergeVacancyDescription = (_rawHtml, rssFallback) => {
  return rssFallback;
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadFixture() {
  return readFileSync(FIXTURE, 'utf8');
}

function main() {
  const errors = [];
  const fixture = loadFixture();

  try {
    // Test 1: extractVacancyDescriptionHtml reads fixture → non-empty HTML
    const extractedHtml = extractVacancyDescriptionHtml(fixture);
    assert(
      extractedHtml && extractedHtml.length > 0,
      'extractVacancyDescriptionHtml should return non-empty HTML from fixture'
    );
    assert(
      extractedHtml.includes('backend') || extractedHtml.includes('Backend') || extractedHtml.includes('микросервис'),
      'extracted HTML should contain substantive vacancy content'
    );

    // Test 2: stripHtml removes tags and collapses whitespace
    const stripped = stripHtml(extractedHtml);
    assert(!stripped.includes('<'), 'stripped text should not contain <');
    assert(!stripped.includes('>'), 'stripped text should not contain >');
    assert(!/\s{2,}/.test(stripped), 'stripped text should have collapsed whitespace');

    // Test 3: mergeVacancyDescription uses full page, not thin RSS
    const merged = mergeVacancyDescription(fixture, 'thin rss');
    assert(merged.length > 500, `merged description should exceed 500 chars, got ${merged.length}`);
    assert(merged !== 'thin rss', 'merged description should not equal RSS fallback');

    // Test 4: empty HTML → RSS fallback
    const rssOnly = mergeVacancyDescription('', 'rss only');
    assert(rssOnly === 'rss only', `expected "rss only", got "${rssOnly}"`);

    // Test 5: 50k+ truncation
    const longHtml =
      '<p>' + 'x'.repeat(50001) + '</p>';
    const truncated = mergeVacancyDescription(longHtml, 'rss fallback');
    assert(
      truncated.endsWith(TRUNCATION_SUFFIX),
      'truncated result should end with [Description truncated] marker'
    );
    assert(
      truncated.length <= MAX_DESCRIPTION_LENGTH + TRUNCATION_SUFFIX.length,
      `truncated length ${truncated.length} exceeds cap`
    );

    // Test 6: data-qa fallback when JSON-LD absent
    const qaOnlyHtml = `
      <html><body>
        <div data-qa="vacancy-description">
          <div>
            <p>Fallback description from data-qa block with enough content to be substantive for extraction testing purposes.</p>
            <p>Additional paragraph about Python, FastAPI, and distributed systems engineering work.</p>
          </div>
        </div>
      </body></html>`;
    const qaExtracted = extractVacancyDescriptionHtml(qaOnlyHtml);
    assert(
      qaExtracted && qaExtracted.includes('Fallback description'),
      'data-qa fallback should extract vacancy-description block'
    );
  } catch (err) {
    errors.push(err.message);
  }

  if (errors.length > 0) {
    console.error('FAIL:', errors.join('; '));
    process.exit(1);
  }

  console.log('OK: hh.ru vacancy page parse fixture passed');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
