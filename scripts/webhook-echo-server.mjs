// 极简 Webhook 接收器：把收到的 POST 落到磁盘，方便端到端验证。
// 用法：node scripts/webhook-echo-server.mjs [port]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const PORT = parseInt(process.argv[2] || process.env.WEBHOOK_ECHO_PORT || '3099', 10);
const LOG_DIR = process.env.WEBHOOK_ECHO_LOG_DIR || '/tmp/webhook-echo';
fs.mkdirSync(LOG_DIR, { recursive: true });

const counterFile = path.join(LOG_DIR, 'counter.txt');
let seq = 0;
if (fs.existsSync(counterFile)) {
  const n = parseInt(fs.readFileSync(counterFile, 'utf8').trim() || '0', 10);
  if (!Number.isNaN(n)) seq = n;
}

const server = http.createServer(async (req, res) => {
  seq += 1;
  fs.writeFileSync(counterFile, String(seq));
  const id = `${Date.now()}-${seq}`;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString('utf8');
  const file = path.join(LOG_DIR, `${id}.json`);
  const record = {
    id,
    seq,
    method: req.method,
    url: req.url,
    headers: req.headers,
    bodyPreview: body.slice(0, 4000),
    bodyLength: body.length,
    receivedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`[webhook-echo] #${seq} ${req.method} ${req.url} -> ${file} (${body.length} bytes)`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, id, url: `file://${file}`, externalUrl: `file://${file}` }));
});

server.listen(PORT, () => {
  console.log(`[webhook-echo] listening on http://127.0.0.1:${PORT} (logs -> ${LOG_DIR})`);
});
