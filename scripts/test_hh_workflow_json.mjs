#!/usr/bin/env node
/**
 * Offline validation of 01e-scanner-hhru.json workflow structure.
 * Verifies enrichment nodes, HTTP config, Merge Descriptions jsCode content,
 * and SSRF guards — without importing the workflow into n8n.
 *
 * Reads the workflow file as JSON data only; never evaluates or imports code.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = join(__dirname, '../workflows/01e-scanner-hhru.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const errors = [];
  let workflow;

  try {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    workflow = JSON.parse(raw);
  } catch (err) {
    console.error('FAIL: Could not load/parse 01e workflow JSON:', err.message);
    process.exit(1);
  }

  try {
    const nodes = workflow.nodes || [];

    // ── Check 1: All 4 enrichment nodes exist, each exactly once ──
    const nodeNames = nodes.map((n) => n.name);
    const countByName = {};
    for (const name of nodeNames) {
      countByName[name] = (countByName[name] || 0) + 1;
    }

    const requiredNodes = ['Loop Over Jobs', 'Fetch Vacancy Page', 'Wait 1s Vacancy', 'Merge Descriptions'];
    for (const name of requiredNodes) {
      assert(
        countByName[name] === 1,
        `Node "${name}" should appear exactly 1 time, found ${countByName[name] || 0}`
      );
    }

    // ── Check 2: Fetch Vacancy Page has followRedirect / maxRedirects ──
    const fetchNode = nodes.find((n) => n.name === 'Fetch Vacancy Page');
    assert(fetchNode, 'Fetch Vacancy Page node not found');
    const redirectOpts = fetchNode.parameters?.options?.redirect || {};
    assert(
      redirectOpts.followRedirects === true,
      'Fetch Vacancy Page should have followRedirects: true'
    );
    assert(
      redirectOpts.maxRedirects === 10,
      'Fetch Vacancy Page should have maxRedirects: 10'
    );

    // ── Check 3: Fetch Vacancy Page has Accept-Language header ──
    const headers = fetchNode.parameters?.headerParameters?.parameters || [];
    const headerNames = headers.map((h) => h.name);
    assert(
      headerNames.includes('Accept-Language'),
      'Fetch Vacancy Page should have Accept-Language header'
    );
    assert(
      headerNames.includes('Accept'),
      'Fetch Vacancy Page should have Accept header'
    );
    assert(
      headerNames.includes('User-Agent'),
      'Fetch Vacancy Page should have User-Agent header'
    );

    // ── Check 4: Fetch Vacancy Page has alwaysOutputData + onError continueRegularOutput ──
    assert(
      fetchNode.alwaysOutputData === true,
      'Fetch Vacancy Page should have alwaysOutputData: true'
    );
    assert(
      fetchNode.onError === 'continueRegularOutput',
      'Fetch Vacancy Page should have onError: continueRegularOutput'
    );

    // ── Check 5: Merge Descriptions jsCode content ──
    const mergeNode = nodes.find((n) => n.name === 'Merge Descriptions');
    assert(mergeNode, 'Merge Descriptions node not found');
    const jsCode = mergeNode.parameters?.jsCode || '';
    assert(jsCode.length > 0, 'Merge Descriptions jsCode should not be empty');

    // 5a: SSRF whitelist — hh.ru/vacancy regex check
    assert(
      /hh\\.ru\\\/vacancy/.test(jsCode) || /https:\/\/hh\.ru\/vacancy/.test(jsCode),
      'Merge Descriptions jsCode should contain SSRF whitelist for hh.ru/vacancy'
    );

    // 5b: Diagnostics — _fetchHtmlBytes, _fetchStatus, _fetchHint
    assert(
      jsCode.includes('_fetchHtmlBytes'),
      'Merge Descriptions jsCode should contain _fetchHtmlBytes diagnostic'
    );
    assert(
      jsCode.includes('_fetchStatus'),
      'Merge Descriptions jsCode should contain _fetchStatus diagnostic'
    );
    assert(
      jsCode.includes('_fetchHint'),
      'Merge Descriptions jsCode should contain _fetchHint diagnostic'
    );

    // 5c: 50000 truncation logic
    assert(
      jsCode.includes('50000'),
      'Merge Descriptions jsCode should contain 50000 truncation logic'
    );
    assert(
      jsCode.includes('[Description truncated]'),
      'Merge Descriptions jsCode should contain truncation marker'
    );

    // 5d: extractVacancyDescriptionHtml and stripHtml function bodies
    assert(
      jsCode.includes('extractVacancyDescriptionHtml'),
      'Merge Descriptions jsCode should contain extractVacancyDescriptionHtml'
    );
    assert(
      jsCode.includes('stripHtml'),
      'Merge Descriptions jsCode should contain stripHtml'
    );
  } catch (err) {
    errors.push(err.message);
  }

  if (errors.length > 0) {
    console.error('FAIL:', errors.join('\n  - '));
    process.exit(1);
  }

  console.log('OK: hh.ru workflow JSON structure validation passed');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
