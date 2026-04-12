#!/usr/bin/env node
/**
 * Notion Sync Skill — Read/write Notion pages and databases.
 *
 * Required env: NOTION_API_KEY
 *
 * Usage:
 *   notion-sync search --query "meeting notes"
 *   notion-sync read --page-id "abc123"
 *   notion-sync create --parent-id "abc123" --title "New Page" --content "..."
 */

const https = require('https');
const NOTION_KEY = process.env.NOTION_API_KEY;

if (!NOTION_KEY) {
  console.error('Error: NOTION_API_KEY required.');
  process.exit(1);
}

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com',
      path: `/v1${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function search(query) {
  const result = await notionRequest('POST', '/search', { query, page_size: 5 });
  return {
    success: true,
    results: (result.results || []).map(r => ({
      id: r.id,
      type: r.object,
      title: r.properties?.title?.title?.[0]?.plain_text || r.properties?.Name?.title?.[0]?.plain_text || '(untitled)',
      url: r.url,
      lastEdited: r.last_edited_time,
    })),
  };
}

async function main() {
  const [action, ...rest] = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < rest.length; i += 2) {
    params[rest[i].replace('--', '')] = rest[i + 1];
  }

  let result;
  switch (action) {
    case 'search': result = await search(params.query || ''); break;
    case 'read': result = await notionRequest('GET', `/pages/${params['page-id']}`); break;
    default: result = { error: `Unknown action: ${action}` };
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
