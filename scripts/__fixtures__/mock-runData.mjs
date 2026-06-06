/**
 * Mock n8n runData fixtures for testing parseRunData().
 *
 * buildMockRunData(options) — generates a realistic runData matching the 01e
 *   node structure. Default: 5 feeds, ~30 raw RSS items, ~22 after geo filter,
 *   18 after dedup, 4 net-new Pipeline records, 4 created.
 *
 * emptyRunData — execution with zero feeds (no output from Build Feed List).
 * errorExecutionData — execution wrapper with error data populated.
 */

/**
 * Create an n8n-style item: { json: { ... } }
 */
function item(jsonPayload) {
  return { json: jsonPayload };
}

/**
 * Create an n8n-style execution entry for a single-output node.
 * @param {number} count - Number of items in the output
 * @param {(idx: number) => object} generator - Function that generates the json payload per item
 * @returns {{ output: Array<Array<{json: object}>> }}
 */
function singleOutputEntry(count, generator = () => ({})) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(item(generator(i)));
  }
  return { output: [items] };
}

/**
 * Create a _empty sentinel entry.
 */
function emptyEntry(message = 'Empty batch') {
  return {
    output: [[item({ _empty: true, _message: message })]]
  };
}

/**
 * Build a complete mock execution data object.
 *
 * @param {object} opts
 * @param {number}  opts.feedCount          - Number of feeds (default: 5)
 * @param {number[]} opts.itemsPerFeed      - Raw RSS items per feed (default: [8,7,6,5,4])
 * @param {number[]} opts.afterGeoPerFeed   - Items surviving geo filter per feed (default: [6,5,5,3,3])
 * @param {number}   opts.afterDedup        - Items after within-run dedup (default: 18)
 * @param {number}   opts.netNew            - Net-new items after Pipeline dedup (default: 4)
 * @param {number}   opts.pipelineCreated   - Pipeline records created (default: 4)
 * @param {boolean}  opts.hasDedupSentinel  - Whether Deduplicate vs Pipeline returned _empty (default: false)
 * @param {string}   opts.status            - Execution status (default: 'success')
 * @param {string}   opts.startedAt         - ISO timestamp
 * @param {string}   opts.stoppedAt         - ISO timestamp
 * @param {object|null} opts.error          - Error details (default: null)
 * @returns {{ data: { runData: object }, status: string, startedAt: string, stoppedAt: string, error: object|null }}
 */
export function buildMockRunData(opts = {}) {
  const {
    feedCount = 5,
    itemsPerFeed = [8, 7, 6, 5, 4],
    afterGeoPerFeed = [6, 5, 5, 3, 3],
    afterDedup = 18,
    netNew = 4,
    pipelineCreated = 4,
    hasDedupSentinel = false,
    status = 'success',
    startedAt = '2026-06-07T08:20:00.000Z',
    stoppedAt = '2026-06-07T08:24:30.000Z',
    error = null,
  } = opts;

  // Build Feed List — single output, one entry per feed
  const buildFeedEntries = [];
  for (let f = 0; f < feedCount; f++) {
    buildFeedEntries.push(item({
      feedUrl: `https://hh.ru/search/vacancy/rss?text=role${f}&area=113`,
      sourceQuery: `role${f}`,
      sourceTag: 'Profile Auto-feed',
      feedMeta: { type: 'auto', role: `Role ${f}` }
    }));
  }

  // RSS Feed Read — one loop iteration per feed
  const rssFeedReadEntries = [];
  for (let f = 0; f < feedCount; f++) {
    const count = itemsPerFeed[f] || 0;
    if (count === 0) {
      rssFeedReadEntries.push(emptyEntry(`No RSS items for feed ${f}`));
    } else {
      const feedItems = [];
      for (let i = 0; i < count; i++) {
        feedItems.push(item({
          jobId: `feed${f}-job${i}-hhr`,
          jobTitle: `Role ${f} Position ${i}`,
          company: `Company ${f}`,
          location: `Moscow`,
          applyLink: `https://hh.ru/vacancy/${f}${i}`,
          jobDescription: `Description for job ${f}.${i}`,
          source: 'hh.ru',
          feedIndex: f
        }));
      }
      rssFeedReadEntries.push({ output: [feedItems] });
    }
  }

  // Parse & Filter Jobs — one loop iteration per feed
  const parseFilterEntries = [];
  for (let f = 0; f < feedCount; f++) {
    const count = afterGeoPerFeed[f] || 0;
    if (count === 0) {
      parseFilterEntries.push(emptyEntry(`No geo-match for feed ${f}`));
    } else {
      const filteredItems = [];
      for (let i = 0; i < count; i++) {
        filteredItems.push(item({
          jobId: `feed${f}-job${i}-hhr`,
          jobTitle: `Role ${f} Position ${i}`,
          company: `Company ${f}`,
          location: `Moscow`,
          applyLink: `https://hh.ru/vacancy/${f}${i}`,
          jobDescription: `Description for job ${f}.${i}`,
          source: 'hh.ru',
          feedIndex: f,
          geoMatch: true,
          titleKeywords: ['keyword']
        }));
      }
      parseFilterEntries.push({ output: [filteredItems] });
    }
  }

  // Aggregate All Jobs — single output after within-run dedup
  const aggregatedItems = [];
  for (let i = 0; i < afterDedup; i++) {
    const feedIdx = i % feedCount;
    aggregatedItems.push(item({
      jobId: `agg-job-${i}-hhr`,
      jobTitle: `Aggregated Position ${i}`,
      company: `Company ${feedIdx}`,
      location: `Moscow`,
      applyLink: `https://hh.ru/vacancy/${i}`,
      jobDescription: `Description for aggregated job ${i}`,
      source: 'hh.ru',
      feedIndex: feedIdx,
      geoMatch: true
    }));
  }
  const aggregateEntry = afterDedup === 0
    ? emptyEntry('No jobs aggregated from HH RSS feeds')
    : { output: [aggregatedItems] };

  // Deduplicate vs Pipeline — net-new items or _empty sentinel
  let dedupEntry;
  if (hasDedupSentinel) {
    dedupEntry = emptyEntry('All jobs already in Pipeline');
  } else {
    const netNewItems = [];
    for (let i = 0; i < netNew; i++) {
      netNewItems.push(item({
        jobId: `netnew-job-${i}-hhr`,
        jobTitle: `Net New Position ${i}`,
        company: `Company ${i}`,
        location: `Moscow`,
        applyLink: `https://hh.ru/vacancy/netnew/${i}`,
        jobDescription: `Description for net-new job ${i}`,
        source: 'hh.ru'
      }));
    }
    dedupEntry = netNew === 0
      ? emptyEntry('No net-new jobs')
      : { output: [netNewItems] };
  }

  // Create Pipeline Records — actual created records
  let pipelineEntry;
  if (pipelineCreated > 0) {
    const createdItems = [];
    for (let i = 0; i < pipelineCreated; i++) {
      createdItems.push(item({
        id: `rec${i}`,
        jobId: `netnew-job-${i}-hhr`,
        jobTitle: `Net New Position ${i}`,
        company: `Company ${i}`,
        status: 'New'
      }));
    }
    pipelineEntry = { output: [createdItems] };
  } else {
    pipelineEntry = { output: [[]] }; // No output items
  }

  const runData = {
    'Build Feed List': buildFeedEntries.length > 0
      ? [{ output: [buildFeedEntries] }]
      : [{ output: [[]] }],
    'RSS Feed Read': rssFeedReadEntries,
    'Parse & Filter Jobs': parseFilterEntries,
    'Aggregate All Jobs': [aggregateEntry],
    'Deduplicate vs Pipeline': [dedupEntry],
    'Create Pipeline Records': [pipelineEntry],
  };

  return {
    data: { runData },
    status,
    startedAt,
    stoppedAt,
    error,
  };
}

/**
 * Minimal execution wrapper with no runData — for missing-node tests.
 */
export const emptyRunData = {
  data: { runData: {} },
  status: 'success',
  startedAt: '2026-06-07T08:20:00.000Z',
  stoppedAt: '2026-06-07T08:20:01.000Z',
  error: null,
};

/**
 * Execution wrapper with error data.
 */
export const errorExecutionData = {
  data: {
    runData: {
      'Build Feed List': [{ output: [[{ json: { feedUrl: 'test' } }]] }],
    }
  },
  status: 'error',
  startedAt: '2026-06-07T08:20:00.000Z',
  stoppedAt: '2026-06-07T08:20:30.000Z',
  error: {
    message: 'Safety brake: 150 net-new jobs exceeds 100 limit',
    stack: 'Error: Safety brake: 150 net-new jobs exceeds 100 limit\n    at Deduplicate vs Pipeline (eval at ...)\n    at ...',
  },
};
