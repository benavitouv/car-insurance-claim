import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const PORT = Number(process.env.PORT || 5173);
const PUBLIC_DIR = join(process.cwd(), 'public');

const getEnv = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const WEBHOOK_URL = getEnv(
  'WEBHOOK_URL',
  'https://api.demo.wonderful.ai/api/v1/tasks/webhook/d691938b-81b4-44f3-b86a-ff827bd14f1b'
);
const WEBHOOK_SECRET = getEnv(
  'WEBHOOK_SECRET',
  '43c7b9ac-8d55-4a13-831f-cc7d57beede6'
);
const TASK_TYPE = process.env.TASK_TYPE || 'process_claim';
const TRIGGER_ID =
  process.env.TRIGGER_ID || '4fd88805-7cde-4a7a-9d99-5347e5fb308e';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
};

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const triggerWebhook = async ({ email, fullName }) => {
  const webhookResponse = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'x-webhook-secret': WEBHOOK_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trigger_id: TRIGGER_ID,
      task_type: TASK_TYPE,
      payload: {
        customer_email: email,
        customer_name: fullName,
      },
    }),
  });

  if (!webhookResponse.ok) {
    const text = await webhookResponse.text();
    throw new Error(`Webhook failed (${webhookResponse.status}): ${text}`);
  }

  return webhookResponse.json();
};

const serveStatic = async (req, res, url) => {
  const pathname = url.pathname === '/' ? 'index.html' : url.pathname;
  const safePath = pathname.replace(/^[/\\\\]+/, '');
  const publicRoot = normalize(PUBLIC_DIR);
  const resolvedPath = normalize(join(publicRoot, safePath));
  const normalizedRoot = publicRoot.endsWith(sep) ? publicRoot : `${publicRoot}${sep}`;

  if (!resolvedPath.startsWith(normalizedRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const file = await readFile(resolvedPath);
    const extension = extname(resolvedPath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(file);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/submit') {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });

      const { full_name, email } = JSON.parse(body);
      const fullName = String(full_name || '').trim();
      const emailValue = String(email || '').trim();

      if (!fullName || !emailValue) {
        jsonResponse(res, 400, {
          ok: false,
          error: 'missing_fields',
          message: 'Please fill in all required fields.',
        });
        return;
      }

      const webhookResult = await triggerWebhook({ email: emailValue, fullName });
      jsonResponse(res, 200, { ok: true, webhook: webhookResult });
    } catch (error) {
      jsonResponse(res, 500, {
        ok: false,
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  await serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Car insurance claim server running at http://localhost:${PORT}`);
});
