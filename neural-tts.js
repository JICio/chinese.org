/* 微軟 Edge 朗讀接口（曉曉 Neural 等自然語音）。
   非官方端點，失敗兩次自動停用並回退瀏覽器語音。 */
window.NeuralTTS = (() => {
  const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  const cache = new Map(); // voice|text -> blob URL
  let audioEl = null;
  let enabled = 'WebSocket' in window && 'crypto' in window && !!crypto.subtle;
  let failures = 0;

  async function gecToken() {
    const seconds = Math.floor(Date.now() / 1000) + 11644473600;
    const rounded = seconds - (seconds % 300);
    const input = `${rounded * 1e7}${TOKEN}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  const uuid = () => crypto.randomUUID().replace(/-/g, '');

  const escapeXml = text => text.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  function synthesize(text, voice, rate) {
    return new Promise((resolve, reject) => {
      gecToken().then(gec => {
        const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
          + `?TrustedClientToken=${TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${uuid()}`;
        const ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';
        const chunks = [];
        const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('timeout')); }, 10000);
        ws.onopen = () => {
          const now = new Date().toISOString();
          ws.send(`X-Timestamp:${now}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
            + '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
          const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>`
            + `<voice name='${voice}'><prosody rate='${rate}'>${escapeXml(text)}</prosody></voice></speak>`;
          ws.send(`X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n${ssml}`);
        };
        ws.onmessage = event => {
          if (typeof event.data === 'string') {
            if (event.data.includes('Path:turn.end')) {
              clearTimeout(timer);
              try { ws.close(); } catch {}
              resolve(new Blob(chunks, { type: 'audio/mpeg' }));
            }
            return;
          }
          const data = new Uint8Array(event.data);
          const headerLen = (data[0] << 8) | data[1];
          const header = new TextDecoder().decode(data.subarray(2, 2 + headerLen));
          if (header.includes('Path:audio')) chunks.push(data.subarray(2 + headerLen));
        };
        ws.onerror = () => { clearTimeout(timer); reject(new Error('ws error')); };
        ws.onclose = () => { clearTimeout(timer); if (!chunks.length) reject(new Error('no audio')); };
      }).catch(reject);
    });
  }

  function stop() {
    if (audioEl) {
      audioEl.onended = null;
      audioEl.onerror = null;
      audioEl.pause();
      audioEl = null;
    }
  }

  async function speak(text, { voice = 'zh-CN-XiaoxiaoNeural', rate = '+8%' } = {}) {
    if (!enabled) throw new Error('disabled');
    const key = `${voice}|${rate}|${text}`;
    let url = cache.get(key);
    if (!url) {
      const blob = await synthesize(text, voice, rate);
      if (blob.size < 256) throw new Error('empty audio');
      url = URL.createObjectURL(blob);
      if (cache.size > 80) {
        const oldest = cache.keys().next().value;
        URL.revokeObjectURL(cache.get(oldest));
        cache.delete(oldest);
      }
      cache.set(key, url);
    }
    stop();
    const el = new Audio(url);
    audioEl = el;
    await el.play(); // 未解鎖自動播放時會 reject → 外層回退
    return new Promise(resolve => {
      el.onended = resolve;
      el.onerror = resolve;
    });
  }

  function markFailure() {
    failures += 1;
    if (failures >= 2) enabled = false;
  }

  // 在用戶手勢裡呼叫一次，解鎖之後的自動播放
  function unlock() {
    try {
      const el = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=');
      el.volume = 0.01;
      el.play().catch(() => {});
    } catch {}
  }

  return { speak, stop, markFailure, unlock, get enabled() { return enabled; } };
})();
