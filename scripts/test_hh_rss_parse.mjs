#!/usr/bin/env node
/**
 * Automated parse smoke test for hh.ru RSS description HTML.
 * Mirrors stripHtml + parseHhDescription in workflows/01e-scanner-hhru.json.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '../fixtures/hh-rss-sample.xml');

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

export const parseHhDescription = (stripped) => {
  const companyMatch = stripped.match(/Вакансия компании:\s*(.+?)(?=\s+Создана:|$)/i);
  const regionMatch = stripped.match(/Регион:\s*(.+?)(?=\s+Предполагаемый|$)/i);
  const salaryMatch = stripped.match(
    /Предполагаемый уровень месячного дохода:\s*(.+?)$/i
  );

  const company = companyMatch ? companyMatch[1].trim() : 'Unknown';
  const region = regionMatch ? regionMatch[1].trim() : '';
  let salaryInfo = '';
  if (salaryMatch) {
    const raw = salaryMatch[1].trim();
    if (raw && !/не\s+указан/i.test(raw)) {
      salaryInfo = raw;
    }
  }

  return { company, region, salaryInfo };
};

function extractDescriptionFromFixture(xml) {
  const match = xml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
  if (!match) throw new Error('No CDATA description found in fixture');
  return match[1];
}

function main() {
  const xml = readFileSync(FIXTURE, 'utf8');
  const html = extractDescriptionFromFixture(xml);
  const stripped = stripHtml(html);
  const parsed = parseHhDescription(stripped);

  const errors = [];
  if (!stripped.includes('Вакансия компании:')) {
    errors.push('stripped text missing company label');
  }
  if (stripped.includes('<p>') || stripped.includes('</p>')) {
    errors.push('stripped description still contains <p> tags');
  }
  if (parsed.company !== 'Визионеро') {
    errors.push(`expected company "Визионеро", got "${parsed.company}"`);
  }
  if (parsed.region !== 'Санкт-Петербург') {
    errors.push(`expected region "Санкт-Петербург", got "${parsed.region}"`);
  }
  if (parsed.salaryInfo !== 'до 140 000 ₽' && !parsed.salaryInfo.includes('140')) {
    errors.push(`expected salary with 140000, got "${parsed.salaryInfo}"`);
  }

  if (errors.length > 0) {
    console.error('FAIL:', errors.join('; '));
    console.error('stripped:', stripped);
    console.error('parsed:', parsed);
    process.exit(1);
  }

  console.log('OK: hh.ru RSS parse fixture passed');
  console.log(JSON.stringify(parsed, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
