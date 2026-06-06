/**
 * parseRunData — Extract per-node item counts from an n8n execution runData structure.
 *
 * Accepts an execution wrapper object:
 *   { data: { runData: { 'Node Name': [ { output: [ [items] ] }, ... ] } },
 *     status, startedAt, stoppedAt, error }
 *
 * Returns a MetricsResult object with per-stage item counts, loop summation,
 * _empty sentinel filtering, and error detection.
 *
 * Exported as default function for n8n Code node compatibility.
 */

/**
 * @typedef {object} MetricsResult
 * @property {boolean}  valid
 * @property {string|null} error
 * @property {number}   feedsGenerated
 * @property {number}   totalRssItems
 * @property {Array<{feedIndex: number, items: number, total: number}>} perFeedItems
 * @property {number}   afterGeoFilter
 * @property {Array<{feedIndex: number, items: number}>} perFeedAfterGeo
 * @property {number}   afterDedup
 * @property {number}   netNewPipelineRecords
 * @property {number}   pipelineRecordsCreated
 * @property {string}   executionStatus
 * @property {object|null} errorDetails
 * @property {number}   runDurationSeconds
 * @property {string|null} startedAt
 * @property {string|null} stoppedAt
 */

/**
 * Default export — parse an n8n execution wrapper into structured metrics.
 *
 * @param {object} executionData - { data: { runData }, status, startedAt, stoppedAt, error }
 * @returns {MetricsResult}
 */
export default function parseRunData(executionData) {
  // --- Null-safe extraction ---
  const data = executionData?.data || {};
  const runData = data?.runData || {};
  const executionStatus = executionData?.status || 'unknown';
  const startedAt = executionData?.startedAt || null;
  const stoppedAt = executionData?.stoppedAt || null;

  // --- Error detection ---
  const latestError =
    executionData?.data?.resultData?.error ||
    executionData?.error ||
    null;

  let errorDetails = null;
  if (latestError) {
    errorDetails = {
      message: latestError.message || 'Unknown error',
      lastNodeExecuted: latestError.lastNodeExecuted || null,
      stack: latestError.stack
        ? latestError.stack.split('\n').slice(0, 3).join('\n')
        : null,
    };
  }

  // --- Helper: count items across all loop iterations, filtering _empty ---
  function sumNodeRealItems(nodeName) {
    const entries = runData[nodeName];
    if (!entries || !Array.isArray(entries)) return 0;
    return entries.reduce((total, entry) => {
      const output0 = entry?.output?.[0];
      if (!output0 || !Array.isArray(output0)) return total;
      const realItems = output0.filter(
        (item) => item && item.json && !item.json._empty
      );
      return total + realItems.length;
    }, 0);
  }

  // --- Helper: count all items (including _empty) across loop iterations ---
  function sumNodeAllItems(nodeName) {
    const entries = runData[nodeName];
    if (!entries || !Array.isArray(entries)) return 0;
    return entries.reduce((total, entry) => {
      const output0 = entry?.output?.[0];
      if (!output0 || !Array.isArray(output0)) return total;
      return total + output0.length;
    }, 0);
  }

  // --- Helper: count items in a single-output node ---
  function singleNodeRealItems(nodeName) {
    const entry = runData[nodeName]?.[0];
    const output0 = entry?.output?.[0];
    if (!output0 || !Array.isArray(output0)) return 0;
    return output0.filter((item) => item && item.json && !item.json._empty).length;
  }

  // --- Helper: count ALL items in a single-output node (including _empty) ---
  function singleNodeAllItems(nodeName) {
    return runData[nodeName]?.[0]?.output?.[0]?.length || 0;
  }

  // --- Feeds generated ---
  const feedsGenerated = singleNodeAllItems('Build Feed List');

  // --- Total RSS items (summed across loop iterations) ---
  const totalRssItems = sumNodeRealItems('RSS Feed Read');

  // --- Per-feed breakdown ---
  const perFeedItems = (runData['RSS Feed Read'] || []).map((entry, idx) => {
    const output0 = entry?.output?.[0] || [];
    const total = output0.length;
    const items = output0.filter(
      (item) => item && item.json && !item.json._empty
    ).length;
    return { feedIndex: idx, items, total };
  });

  // --- After geo filter (summed across loop iterations) ---
  const afterGeoFilter = sumNodeRealItems('Parse & Filter Jobs');

  const perFeedAfterGeo = (runData['Parse & Filter Jobs'] || []).map((entry, idx) => {
    const output0 = entry?.output?.[0] || [];
    const items = output0.filter(
      (item) => item && item.json && !item.json._empty
    ).length;
    return { feedIndex: idx, items };
  });

  // --- After within-run dedup ---
  const afterDedup = singleNodeRealItems('Aggregate All Jobs');

  // --- Net-new Pipeline records (filter _empty) ---
  const netNewPipelineRecords = singleNodeRealItems('Deduplicate vs Pipeline');

  // --- Pipeline records created ---
  const pipelineRecordsCreated = singleNodeAllItems('Create Pipeline Records');

  // --- Validity ---
  // valid is false if any required node is missing OR if feedsGenerated === 0
  const requiredNodes = [
    'Build Feed List',
    'RSS Feed Read',
    'Parse & Filter Jobs',
    'Aggregate All Jobs',
    'Deduplicate vs Pipeline',
  ];
  const allPresent = requiredNodes.every(
    (name) => runData[name] && Array.isArray(runData[name]) && runData[name].length > 0
  );
  const valid = allPresent && feedsGenerated > 0 && executionStatus !== 'error';

  // --- Duration ---
  let runDurationSeconds = 0;
  if (startedAt && stoppedAt) {
    runDurationSeconds = Math.max(
      0,
      (new Date(stoppedAt) - new Date(startedAt)) / 1000
    );
  }

  return {
    valid,
    error: latestError ? (latestError.message || 'Error during execution') : null,
    feedsGenerated,
    totalRssItems,
    perFeedItems,
    afterGeoFilter,
    perFeedAfterGeo,
    afterDedup,
    netNewPipelineRecords,
    pipelineRecordsCreated,
    executionStatus,
    errorDetails,
    runDurationSeconds,
    startedAt,
    stoppedAt,
  };
}
