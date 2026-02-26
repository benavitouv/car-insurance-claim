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

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonResponse(res, 405, {
      ok: false,
      error: 'method_not_allowed',
      message: 'Only POST is allowed.',
    });
  }

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
      return jsonResponse(res, 400, {
        ok: false,
        error: 'missing_fields',
        message: 'Please fill in all required fields.',
      });
    }

    const webhookResult = await triggerWebhook({ email: emailValue, fullName });

    return jsonResponse(res, 200, { ok: true, webhook: webhookResult });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
