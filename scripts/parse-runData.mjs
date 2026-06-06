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

  // --- Shared helpers ---

  /** Extract primary output[0] array from a runData entry, null-safe. */
  function getOutput(entry) {
    return entry?.output?.[0] || [];
  }

  /** Filter n8n items to exclude _empty sentinel markers. */
  function filterReal(arr) {
    return (arr || []).filter((item) => item && item.json && !item.json._empty);
  }

  /** Count real (non-_empty) items across all loop iterations of a node. */
  function sumNodeReal(nodeName) {
    const entries = runData[nodeName];
    if (!entries || !Array.isArray(entries)) return 0;
    return entries.reduce((total, entry) => {
      return total + filterReal(getOutput(entry)).length;
    }, 0);
  }

  /** Count ALL items (including _empty) across all loop iterations of a node. */
  function sumNodeAll(nodeName) {
    const entries = runData[nodeName];
    if (!entries || !Array.isArray(entries)) return 0;
    return entries.reduce((total, entry) => {
      return total + getOutput(entry).length;
    }, 0);
  }

  /** Count real (non-_empty) items in a single-output (non-loop) node. */
  function singleReal(nodeName) {
    return filterReal(getOutput(runData[nodeName]?.[0])).length;
  }

  /** Count ALL items in a single-output node. */
  function singleAll(nodeName) {
    return getOutput(runData[nodeName]?.[0]).length;
  }

  // --- Feeds generated ---
  const feedsGenerated = singleAll('Build Feed List');

  // --- Total RSS items (summed across loop iterations) ---
  const totalRssItems = sumNodeReal('RSS Feed Read');

  // --- Per-feed breakdown ---
  const perFeedItems = (runData['RSS Feed Read'] || []).map((entry, idx) => {
    const arr = getOutput(entry);
    return { feedIndex: idx, items: filterReal(arr).length, total: arr.length };
  });

  // --- After geo filter (summed across loop iterations) ---
  const afterGeoFilter = sumNodeReal('Parse & Filter Jobs');

  const perFeedAfterGeo = (runData['Parse & Filter Jobs'] || []).map((entry, idx) => {
    return { feedIndex: idx, items: filterReal(getOutput(entry)).length };
  });

  // --- After within-run dedup ---
  const afterDedup = singleReal('Aggregate All Jobs');

  // --- Net-new Pipeline records (filter _empty) ---
  const netNewPipelineRecords = singleReal('Deduplicate vs Pipeline');

  // --- Pipeline records created ---
  const pipelineRecordsCreated = singleAll('Create Pipeline Records');

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
