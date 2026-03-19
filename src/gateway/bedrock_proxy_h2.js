#!/usr/bin/env node
/**
 * Bedrock Converse API HTTP/2 Proxy for OpenClaw Multi-Tenant Platform.
 *
 * Intercepts AWS SDK Bedrock Converse API calls (HTTP/2) from OpenClaw Gateway,
 * extracts user message, forwards to Tenant Router → AgentCore → microVM,
 * returns response in Bedrock Converse API format.
 *
 * Usage:
 *   TENANT_ROUTER_URL=http://127.0.0.1:8090 node bedrock_proxy_h2.js
 *   Then set: AWS_ENDPOINT_URL_BEDROCK_RUNTIME=http://localhost:8091
 */

const http2 = require('node:http2');
const http = require('node:http');
const { URL } = require('node:url');

const PORT = parseInt(process.env.PROXY_PORT || '8091');
const TENANT_ROUTER_URL = process.env.TENANT_ROUTER_URL || 'http://127.0.0.1:8090';

function log(msg) {
  console.log(`${new Date().toISOString()} [bedrock-proxy-h2] ${msg}`);
}

function extractUserMessage(body) {
  const messages = body.messages || [];
  const systemParts = body.system || [];

  // Last user message
  let userText = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const content = messages[i].content || [];
      userText = content
        .filter(b => b.text)
        .map(b => b.text)
        .join(' ')
        .trim();
      break;
    }
  }

  // Extract channel/sender identity from user message text first (primary),
  // then fall back to system prompt regex (legacy), then MD5 hash (last resort).
  //
  // OpenClaw embeds identity in user messages, not system prompts. Formats:
  //   Slack:    "Slack DM from W017LFGP267: hello"
  //             "Slack message in #general from W017LFGP267: hello"
  //   WhatsApp: "WhatsApp message from 8613800138000: hello"
  //   Telegram: "Telegram message from 123456789: hello"
  //             "Telegram message in GroupName from 123456789: hello"
  //   Discord:  "Discord DM from username#1234: hello"
  //             "Discord message in #channel from username#1234: hello"

  let channel = 'unknown';
  let userId = 'unknown';

  // --- Primary: extract from user message text ---

  // Slack DM: "Slack DM from <userId>:"
  const slackDm = userText.match(/Slack DM from ([\w]+):/i);
  // Slack channel: "Slack message in #<channel> from <userId>:"
  const slackChan = userText.match(/Slack (?:message )?in #([\w-]+).*?from ([\w]+):/i);
  // WhatsApp: "WhatsApp message from <phone>:"
  const waDm = userText.match(/WhatsApp (?:message |DM )?from ([\w+\-.]+):/i);
  // WhatsApp group: "WhatsApp message in <group> from <phone>:"
  const waGroup = userText.match(/WhatsApp (?:message )?in (.+?) from ([\w+\-.]+):/i);
  // Telegram: "Telegram message from <userId>:"
  const tgDm = userText.match(/Telegram (?:message |DM )?from ([\w]+):/i);
  // Telegram group: "Telegram message in <group> from <userId>:"
  const tgGroup = userText.match(/Telegram (?:message )?in (.+?) from ([\w]+):/i);
  // Discord DM: "Discord DM from <user>:"
  const dcDm = userText.match(/Discord DM from ([\w#]+):/i);
  // Discord channel: "Discord message in #<channel> from <user>:"
  const dcChan = userText.match(/Discord (?:message )?in #([\w-]+).*?from ([\w#]+):/i);

  if (slackChan) {
    channel = 'slack';
    userId = 'chan_' + slackChan[1] + '_' + slackChan[2];
  } else if (slackDm) {
    channel = 'slack';
    userId = 'dm_' + slackDm[1];
  } else if (waGroup) {
    channel = 'whatsapp';
    userId = 'grp_' + waGroup[2];
  } else if (waDm) {
    channel = 'whatsapp';
    userId = waDm[1];
  } else if (tgGroup) {
    channel = 'telegram';
    userId = 'grp_' + tgGroup[2];
  } else if (tgDm) {
    channel = 'telegram';
    userId = tgDm[1];
  } else if (dcChan) {
    channel = 'discord';
    userId = 'chan_' + dcChan[1] + '_' + dcChan[2];
  } else if (dcDm) {
    channel = 'discord';
    userId = 'dm_' + dcDm[1];
  }

  // --- Fallback: system prompt regex (legacy / future structured metadata) ---
  if (userId === 'unknown') {
    const systemText = systemParts
      .map(p => (typeof p === 'string' ? p : p.text || ''))
      .join(' ');

    const chMatch = systemText.match(/(?:channel|source|platform)[:\s]+(\w+)/i);
    if (chMatch) channel = chMatch[1].toLowerCase();

    const idMatch = systemText.match(/(?:sender|from|user|recipient|target)[:\s]+([\w@+\-.]+)/i);
    if (idMatch) userId = idMatch[1];

    // --- Last resort: MD5 hash for stable but opaque tenant_id ---
    if (userId === 'unknown') {
      const crypto = require('node:crypto');
      userId = 'sys-' + crypto.createHash('md5').update(systemText.slice(0, 500)).digest('hex').slice(0, 12);
    }
  }

  return { userText, channel, userId };
}

function forwardToTenantRouter(channel, userId, message) {
  return new Promise((resolve, reject) => {
    const url = new URL('/route', TENANT_ROUTER_URL);
    const payload = JSON.stringify({ channel, user_id: userId, message });

    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 300000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const agentResult = result.response || {};
          const text = (typeof agentResult === 'object' ? agentResult.response : agentResult) || 'No response';
          resolve(String(text));
        } catch (e) {
          resolve(data || 'Parse error');
        }
      });
    });
    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

// Create HTTP/2 server (cleartext, no TLS — for local use)
const server = http2.createServer();

server.on('stream', (stream, headers) => {
  const method = headers[':method'];
  const path = headers[':path'] || '/';

  if (method === 'GET' && (path === '/ping' || path === '/')) {
    stream.respond({ ':status': 200, 'content-type': 'application/json' });
    stream.end(JSON.stringify({ status: 'healthy', service: 'bedrock-proxy-h2' }));
    return;
  }

  if (method !== 'POST') {
    stream.respond({ ':status': 405 });
    stream.end('Method not allowed');
    return;
  }

  const isStream = path.includes('converse-stream');
  let body = '';

  stream.on('data', chunk => body += chunk);
  stream.on('end', async () => {
    try {
      const parsed = JSON.parse(body);
      const { userText, channel, userId } = extractUserMessage(parsed);

      log(`Request: ${path} channel=${channel} user=${userId} msg=${userText.slice(0, 60)}`);

      if (!userText) {
        if (isStream) {
          stream.respond({ ':status': 200, 'content-type': 'application/vnd.amazon.eventstream' });
          const evts = buildEventStream("I didn't receive a message.");
          for (const e of evts) stream.write(e);
          stream.end();
        } else {
          const resp = buildConverseResponse("I didn't receive a message.");
          stream.respond({ ':status': 200, 'content-type': 'application/json' });
          stream.end(JSON.stringify(resp));
        }
        return;
      }

      const responseText = await forwardToTenantRouter(channel, userId, userText);
      log(`Response: ${responseText.slice(0, 80)}`);

      if (isStream) {
        // Bedrock ConverseStream expects application/vnd.amazon.eventstream binary format
        stream.respond({ ':status': 200, 'content-type': 'application/vnd.amazon.eventstream' });
        const evts = buildEventStream(responseText);
        for (const e of evts) stream.write(e);
        stream.end();
      } else {
        stream.respond({ ':status': 200, 'content-type': 'application/json' });
        stream.end(JSON.stringify(buildConverseResponse(responseText)));
      }
    } catch (e) {
      log(`Error: ${e.message}`);
      stream.respond({ ':status': 500, 'content-type': 'application/json' });
      stream.end(JSON.stringify({ message: e.message }));
    }
  });
});

function buildConverseResponse(text) {
  return {
    output: {
      message: {
        role: 'assistant',
        content: [{ text }],
      },
    },
    stopReason: 'end_turn',
    usage: { inputTokens: 0, outputTokens: text.split(/\s+/).length, totalTokens: text.split(/\s+/).length },
    metrics: { latencyMs: 0 },
  };
}

/**
 * Build AWS eventstream binary frames for ConverseStream response.
 * Wire format per event: [total_len:4][headers_len:4][prelude_crc:4][headers][payload][message_crc:4]
 */
function buildEventStream(text) {
  const events = [];

  function crc32(buf) {
    const T = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      T[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = T[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function encodeHeaders(h) {
    const parts = [];
    for (const [k, v] of Object.entries(h)) {
      const kb = Buffer.from(k), vb = Buffer.from(v);
      const b = Buffer.alloc(1 + kb.length + 1 + 2 + vb.length);
      let o = 0;
      b.writeUInt8(kb.length, o); o += 1;
      kb.copy(b, o); o += kb.length;
      b.writeUInt8(7, o); o += 1; // type 7 = string
      b.writeUInt16BE(vb.length, o); o += 2;
      vb.copy(b, o);
      parts.push(b);
    }
    return Buffer.concat(parts);
  }

  function makeEvent(type, payload) {
    const hdrs = {
      ':event-type': type,
      ':content-type': 'application/json',
      ':message-type': 'event',
    };
    const hBuf = encodeHeaders(hdrs);
    const pBuf = Buffer.from(JSON.stringify(payload));
    const total = 12 + hBuf.length + pBuf.length + 4;
    const buf = Buffer.alloc(total);
    let o = 0;
    buf.writeUInt32BE(total, o); o += 4;
    buf.writeUInt32BE(hBuf.length, o); o += 4;
    buf.writeUInt32BE(crc32(buf.slice(0, 8)), o); o += 4;
    hBuf.copy(buf, o); o += hBuf.length;
    pBuf.copy(buf, o); o += pBuf.length;
    buf.writeUInt32BE(crc32(buf.slice(0, o)), o);
    return buf;
  }

  events.push(makeEvent('messageStart', { role: 'assistant' }));
  events.push(makeEvent('contentBlockStart', { contentBlockIndex: 0, start: {} }));
  events.push(makeEvent('contentBlockDelta', { contentBlockIndex: 0, delta: { text } }));
  events.push(makeEvent('contentBlockStop', { contentBlockIndex: 0 }));
  events.push(makeEvent('messageStop', { stopReason: 'end_turn' }));
  const tc = text.split(/\s+/).length;
  events.push(makeEvent('metadata', {
    usage: { inputTokens: 0, outputTokens: tc, totalTokens: tc },
    metrics: { latencyMs: 0 },
  }));

  return events;
}

// Also listen on HTTP/1.1 for health checks and curl testing
const h1Server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'bedrock-proxy-h2', note: 'Use HTTP/2 for Bedrock API' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body);
      const { userText, channel, userId } = extractUserMessage(parsed);
      log(`H1 Request: channel=${channel} user=${userId} msg=${userText.slice(0, 60)}`);
      const responseText = await forwardToTenantRouter(channel, userId, userText);
      log(`H1 Response: ${responseText.slice(0, 80)}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildConverseResponse(responseText)));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: e.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  log(`HTTP/2 proxy listening on port ${PORT}`);
  log(`Tenant Router: ${TENANT_ROUTER_URL}`);
});

// HTTP/1.1 on PORT+1 for health checks
h1Server.listen(PORT + 1, '0.0.0.0', () => {
  log(`HTTP/1.1 health check on port ${PORT + 1}`);
});
