/* Amazon Polly TTS 代理（Cloudflare Worker）
   - AWS 密鑰只存在 Worker 加密環境變量裡，前端永遠看不到
   - 相同文本走 Cloudflare 邊緣緩存，幾乎不消耗 Polly 額度
   - 限制文本長度、聲音白名單、來源域名，防止額度被外人刷
   接口不變：GET /tts?text=...&voice=<azure 風格聲音名>（自動映射到 Polly） */

const VOICE_MAP = [
  { match: v => v.includes('en-US'), voiceId: 'Ivy' },                          // 英文小女孩
  { match: v => v.includes('zh-HK') || v.includes('yue'), voiceId: 'Hiujin' },  // 粵語女聲
  { match: () => true, voiceId: 'Zhiyu' }                                       // 普通話女聲（默認）
];

const ALLOWED_ORIGINS = [
  'https://chinese.org',
  'https://www.chinese.org',
  'http://localhost:4181',
  'http://127.0.0.1:4181'
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}

/* ---------- AWS SigV4 ---------- */
const encoder = new TextEncoder();

async function sha256Hex(data) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function signedPollyRequest(env, payload) {
  const host = `polly.${env.AWS_REGION}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${env.AWS_REGION}/polly/aws4_request`;
  const payloadHash = await sha256Hex(payload);

  const canonical = [
    'POST',
    '/v1/speech',
    '',
    'content-type:application/json',
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    '',
    'content-type;host;x-amz-date',
    payloadHash
  ].join('\n');

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonical)].join('\n');

  const kDate = await hmac(`AWS4${env.AWS_SECRET_ACCESS_KEY}`, date);
  const kRegion = await hmac(kDate, env.AWS_REGION);
  const kService = await hmac(kRegion, 'polly');
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = [...new Uint8Array(await hmac(kSigning, stringToSign))]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return fetch(`https://${host}/v1/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${env.AWS_ACCESS_KEY_ID}/${scope}, `
        + `SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`
    },
    body: payload
  });
}

/* ---------- 入口 ---------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (url.pathname !== '/tts') {
      return new Response('ok', { status: 200 });
    }

    // 軟性來源限制：帶 Origin/Referer 的請求必須來自站點
    const referer = request.headers.get('Referer') || '';
    const fromAllowed = source => ALLOWED_ORIGINS.some(o => source.startsWith(o));
    if ((origin && !fromAllowed(origin)) || (referer && !fromAllowed(referer))) {
      return new Response('forbidden', { status: 403 });
    }

    const text = (url.searchParams.get('text') || '').slice(0, 280).trim();
    const requested = url.searchParams.get('voice') || '';
    if (!text) return new Response('missing text', { status: 400 });
    const voiceId = VOICE_MAP.find(entry => entry.match(requested)).voiceId;

    // 邊緣緩存：同一句話只向 Polly 請求一次
    const cacheKey = new Request(`https://tts-cache/${voiceId}/${encodeURIComponent(text)}`);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
      return new Response(cached.body, { headers });
    }

    const payload = JSON.stringify({
      Engine: 'neural',
      OutputFormat: 'mp3',
      Text: text,
      TextType: 'text',
      VoiceId: voiceId
    });

    const polly = await signedPollyRequest(env, payload);
    if (!polly.ok) {
      const detail = await polly.text();
      return new Response(`polly error ${polly.status}: ${detail.slice(0, 200)}`,
        { status: 502, headers: corsHeaders(origin) });
    }

    const audio = await polly.arrayBuffer();
    const response = new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, s-maxage=2592000, max-age=86400',
        ...corsHeaders(origin)
      }
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};
