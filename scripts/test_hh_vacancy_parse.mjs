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

export const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';

  let text = html;
  text = text.split('&lt;').join('<');
  text = text.split('&gt;').join('>');
  text = text.split('&quot;').join('"');
  text = text.split('&#39;').join("'");
  text = text.split('&apos;').join("'");
  text = text.split('&nbsp;').join(' ');
  text = text.split('&amp;').join('&');

  let result = '';
  let inTag = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '<') {
      inTag = true;
      if (result.length > 0 && result[result.length - 1] !== ' ') {
        result += ' ';
      }
      continue;
    }
    if (ch === '>') {
      inTag = false;
      continue;
    }
    if (!inTag) result += ch;
  }
  return result.replace(/\s+/g, ' ').trim();
};

export const extractVacancyDescriptionHtml = (rawHtml) => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(rawHtml)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const postings = Array.isArray(data) ? data : [data];
      for (const item of postings) {
        if (item && item['@type'] === 'JobPosting' && item.description) {
          return String(item.description);
        }
      }
    } catch {
      // try next block
    }
  }

  const qaRe = /data-qa="vacancy-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i;
  const qa = rawHtml.match(qaRe);
  if (qa && qa[1]) return qa[1];

  return '';
};

export const mergeVacancyDescription = (rawHtml, rssFallback) => {
  const html = extractVacancyDescriptionHtml(rawHtml);
  let text = html ? stripHtml(html) : rssFallback;
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    text = text.substring(0, MAX_DESCRIPTION_LENGTH) + TRUNCATION_SUFFIX;
  }
  return text;
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

    // Test 5: 50k+ truncation (use data-qa block so extraction yields long text)
    const longContent = 'x'.repeat(50001);
    const longHtml = `<div data-qa="vacancy-description"><div><p>${longContent}</p></div></div>`;
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
