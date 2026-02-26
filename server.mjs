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

const BASE_URL = process.env.BASE_URL || 'https://wonderful.app.demo.wonderful.ai';
const API_BASE_URL =
  process.env.API_BASE_URL || BASE_URL.replace('wonderful.app', 'api');

const WEBHOOK_URL = getEnv(
  'WEBHOOK_URL',
  'https://api.demo.wonderful.ai/api/v1/tasks/webhook/39f0d424-c33a-40b8-b1ca-e82d6ee7d906'
);
const WEBHOOK_SECRET = getEnv(
  'WEBHOOK_SECRET',
  '517c4909-f2fb-45d3-8747-9f14ece0593b'
);
const STORAGE_URL = getEnv('STORAGE_URL', `${API_BASE_URL}/api/v1/storage`);
const STORAGE_API_KEY = getEnv(
  'STORAGE_API_KEY',
  'f2440f35-f26d-4145-8c15-295b40987ed6'
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

const readBodyAsFormData = async (req, url) => {
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
  return request.formData();
};

const uploadAttachment = async (file) => {
  const contentType = file.type || 'application/octet-stream';
  const filename = file.name || 'insurance-claim-photo';

  const storageResponse = await fetch(STORAGE_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': STORAGE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename,
      contentType,
    }),
  });

  if (!storageResponse.ok) {
    const text = await storageResponse.text();
    throw new Error(`Storage init failed (${storageResponse.status}): ${text}`);
  }

  const storageJson = await storageResponse.json();
  const attachmentId = storageJson?.data?.id;
  const uploadUrl = storageJson?.data?.url;

  if (!attachmentId || !uploadUrl) {
    throw new Error('Storage response missing attachment id or upload url');
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Upload failed (${uploadResponse.status}): ${text}`);
  }

  return attachmentId;
};

const triggerWebhook = async ({ email, fullName }) => {
  const subject = `Car Insurance Claim - ${fullName}`.trim();

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
        subject,
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
      const formData = await readBodyAsFormData(req, url);
      const fullName = String(formData.get('full_name') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const policyCertificate = String(formData.get('policy_certificate') || '').trim();
      const files = formData.getAll('claim_file').filter((f) => typeof f !== 'string');

      if (!fullName || !email || !policyCertificate) {
        jsonResponse(res, 400, {
          ok: false,
          error: 'missing_fields',
          message: 'Please fill in all required fields.',
        });
        return;
      }

      if (files.length === 0) {
        jsonResponse(res, 400, {
          ok: false,
          error: 'missing_file',
          message: 'Please attach at least one evidence photo.',
        });
        return;
      }

      const attachmentIds = await Promise.all(files.map((f) => uploadAttachment(f)));
      const webhookResult = await triggerWebhook({ email, fullName });

      jsonResponse(res, 200, {
        ok: true,
        attachment_ids: attachmentIds,
        webhook: webhookResult,
      });
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
