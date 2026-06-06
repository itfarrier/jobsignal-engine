/**
 * Test suite for parseRunData() — parses n8n execution runData into structured metrics.
 *
 * Uses Node.js built-in test runner: `node --test` or `node scripts/parse-runData.test.mjs`
 *
 * Tests:
 * 1. Normal execution (5 feeds) — correct counts at each stage
 * 2. Empty/no feeds — feedsGenerated === 0, valid === false
 * 3. All existing (_empty sentinel) — netNewPipelineRecords === 0
 * 4. Error execution — error details populated
 * 5. Missing node in runData — graceful 0 counts, valid === false
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildMockRunData, emptyRunData, errorExecutionData } from './__fixtures__/mock-runData.mjs';
import parseRunData from './parse-runData.mjs';

// ---------------------------------------------------------------------------
// Test 1: Normal execution with 5 feeds
// ---------------------------------------------------------------------------
describe('normal execution (5 feeds)', () => {
  const mockData = buildMockRunData();
  const result = parseRunData(mockData);

  it('should count 5 feeds generated', () => {
    assert.strictEqual(result.feedsGenerated, 5);
  });

  it('should sum 30 total RSS items across all loop iterations', () => {
    assert.strictEqual(result.totalRssItems, 30);
  });

  it('should report per-feed RSS item breakdown', () => {
    assert.ok(Array.isArray(result.perFeedItems));
    assert.strictEqual(result.perFeedItems.length, 5);
    // Feed 0: 8 total items
    assert.strictEqual(result.perFeedItems[0].feedIndex, 0);
    assert.strictEqual(result.perFeedItems[0].total, 8);
    // Feed 4: 4 total items
    assert.strictEqual(result.perFeedItems[4].total, 4);
  });

  it('should count 22 items after geo filter across all loop iterations', () => {
    assert.strictEqual(result.afterGeoFilter, 22);
  });

  it('should report per-feed after-geo breakdown', () => {
    assert.ok(Array.isArray(result.perFeedAfterGeo));
    assert.strictEqual(result.perFeedAfterGeo.length, 5);
    assert.strictEqual(result.perFeedAfterGeo[0].feedIndex, 0);
    assert.strictEqual(result.perFeedAfterGeo[0].items, 6);
    assert.strictEqual(result.perFeedAfterGeo[4].items, 3);
  });

  it('should count 18 items after within-run dedup', () => {
    assert.strictEqual(result.afterDedup, 18);
  });

  it('should count 4 net-new Pipeline records', () => {
    assert.strictEqual(result.netNewPipelineRecords, 4);
  });

  it('should count 4 Pipeline records created', () => {
    assert.strictEqual(result.pipelineRecordsCreated, 4);
  });

  it('should report valid=true', () => {
    assert.strictEqual(result.valid, true);
  });

  it('should report execution status and duration', () => {
    assert.strictEqual(result.executionStatus, 'success');
    assert.strictEqual(result.runDurationSeconds, 270); // 4 min 30 sec
    assert.strictEqual(result.startedAt, '2026-06-07T08:20:00.000Z');
    assert.strictEqual(result.stoppedAt, '2026-06-07T08:24:30.000Z');
  });

  it('should have null error', () => {
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.errorDetails, null);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Empty execution (no feeds)
// ---------------------------------------------------------------------------
describe('empty execution (no feeds)', () => {
  const mockData = buildMockRunData({
    feedCount: 0,
    itemsPerFeed: [],
    afterGeoPerFeed: [],
    afterDedup: 0,
    netNew: 0,
    pipelineCreated: 0,
    hasDedupSentinel: true,
  });
  const result = parseRunData(mockData);

  it('should count 0 feeds generated', () => {
    assert.strictEqual(result.feedsGenerated, 0);
  });

  it('should report valid=false when feedsGenerated === 0', () => {
    assert.strictEqual(result.valid, false);
  });

  it('should report execution status', () => {
    assert.strictEqual(result.executionStatus, 'success');
  });
});

// ---------------------------------------------------------------------------
// Test 3: All jobs already in Pipeline (_empty sentinel)
// ---------------------------------------------------------------------------
describe('all jobs already in Pipeline (_empty sentinel)', () => {
  const mockData = buildMockRunData({
    feedCount: 3,
    itemsPerFeed: [5, 4, 3],
    afterGeoPerFeed: [4, 3, 2],
    afterDedup: 8,
    netNew: 0,
    pipelineCreated: 0,
    hasDedupSentinel: true,
  });
  const result = parseRunData(mockData);

  it('should have 0 net-new Pipeline records', () => {
    assert.strictEqual(result.netNewPipelineRecords, 0);
  });

  it('should have 0 Pipeline records created', () => {
    assert.strictEqual(result.pipelineRecordsCreated, 0);
  });

  it('should report valid=true (feeds are present, just nothing new)', () => {
    assert.strictEqual(result.feedsGenerated, 3);
    assert.strictEqual(result.valid, true);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Error execution
// ---------------------------------------------------------------------------
describe('error execution', () => {
  const result = parseRunData(errorExecutionData);

  it('should report executionStatus "error"', () => {
    assert.strictEqual(result.executionStatus, 'error');
  });

  it('should have errorDetails populated', () => {
    assert.ok(result.errorDetails !== null, 'errorDetails should not be null');
    assert.ok(
      typeof result.errorDetails === 'object',
      'errorDetails should be an object'
    );
  });

  it('should include the error message in errorDetails', () => {
    assert.ok(
      result.errorDetails.message &&
      result.errorDetails.message.includes('Safety brake'),
      'errorDetails.message should contain safety brake message'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: Missing node in runData
// ---------------------------------------------------------------------------
describe('missing node in runData', () => {
  const result = parseRunData(emptyRunData);

  it('should return 0 for feedsGenerated when Build Feed List missing', () => {
    assert.strictEqual(result.feedsGenerated, 0);
  });

  it('should return 0 for totalRssItems when RSS Feed Read missing', () => {
    assert.strictEqual(result.totalRssItems, 0);
  });

  it('should return 0 for afterGeoFilter when Parse & Filter Jobs missing', () => {
    assert.strictEqual(result.afterGeoFilter, 0);
  });

  it('should return 0 for afterDedup when Aggregate All Jobs missing', () => {
    assert.strictEqual(result.afterDedup, 0);
  });

  it('should return 0 for netNewPipelineRecords when Deduplicate vs Pipeline missing', () => {
    assert.strictEqual(result.netNewPipelineRecords, 0);
  });

  it('should return 0 for pipelineRecordsCreated when Create Pipeline Records missing', () => {
    assert.strictEqual(result.pipelineRecordsCreated, 0);
  });

  it('should report valid=false when node data missing', () => {
    assert.strictEqual(result.valid, false);
  });

  it('should not throw an error', () => {
    assert.doesNotThrow(() => parseRunData(emptyRunData));
  });
});
