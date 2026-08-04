/* Azure TTS 代理（Cloudflare Worker）
   - 密鑰只存在 Worker 環境變量裡，前端永遠看不到
   - 相同文本自動走 Cloudflare 邊緣緩存，省 Azure 額度
   - 限制文本長度、語音白名單、來源域名，防止額度被外人刷 */

const ALLOWED_VOICES = new Set([
  'zh-CN-XiaoxiaoNeural',   // 曉曉：溫暖女聲（默認）
  'zh-CN-XiaoyiNeural',     // 曉伊：活潑少女
  'zh-CN-YunxiNeural',      // 雲希：陽光少年
  'zh-CN-YunyangNeural',    // 雲揚：新聞男聲
  'zh-HK-HiuMaanNeural',    // 粵語女聲
  'yue-CN-XiaoMinNeural',   // 粵語（廣州）女聲
  'en-US-AnaNeural'         // 英文小女孩
]);

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

    // 軟性來源限制：瀏覽器請求必須來自站點；無 Origin/Referer 的（如 <audio>）放行
    const referer = request.headers.get('Referer') || '';
    const fromAllowed = source => ALLOWED_ORIGINS.some(o => source.startsWith(o));
    if ((origin && !fromAllowed(origin)) || (referer && !fromAllowed(referer))) {
      return new Response('forbidden', { status: 403 });
    }

    const text = (url.searchParams.get('text') || '').slice(0, 300).trim();
    const voice = url.searchParams.get('voice') || 'zh-CN-XiaoxiaoNeural';
    const rate = /^[+-]\d{1,2}%$/.test(url.searchParams.get('rate') || '') ? url.searchParams.get('rate') : '+5%';
    if (!text) return new Response('missing text', { status: 400 });
    if (!ALLOWED_VOICES.has(voice)) return new Response('voice not allowed', { status: 400 });

    // 邊緣緩存：同一句話只向 Azure 請求一次
    const cacheKey = new Request(`https://tts-cache/${voice}/${rate}/${encodeURIComponent(text)}`);
    const cache = caches.default;
    let cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
      return new Response(cached.body, { headers });
    }

    const escaped = text.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const lang = voice.startsWith('en-') ? 'en-US' : voice.startsWith('zh-HK') ? 'zh-HK' : 'zh-CN';
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>`
      + `<voice name='${voice}'><prosody rate='${rate}'>${escaped}</prosody></voice></speak>`;

    const azure = await fetch(`https://${env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_TTS_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'chinese-org-tts'
      },
      body: ssml
    });

    if (!azure.ok) {
      return new Response(`azure error ${azure.status}`, { status: 502, headers: corsHeaders(origin) });
    }

    const audio = await azure.arrayBuffer();
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
