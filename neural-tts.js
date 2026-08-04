/* 雲端自然語音，三級鏈路：
   ① Amazon Polly 神經語音（經自家 Cloudflare Worker 代理，官方接口最穩）
   ② 百度翻譯發音（無需密鑰的備用線路）
   ③ 頁面內建的瀏覽器語音（最後兜底，由各頁面自己處理）
   TTS_PROXY 為空時自動跳過 ①。粵語/英文由 Worker 映射到對應聲音。 */
window.NeuralTTS = (() => {
  // 自家 Cloudflare Worker（Amazon Polly 神經語音代理）
  const TTS_PROXY = 'https://chinese-tts.lovedaocom.workers.dev';

  let audioEl = null;
  let enabled = true;
  let failures = 0;
  let proxyDown = false;

  function langOf(voice) {
    if (!voice) return 'zh';
    if (voice.includes('en-US')) return 'en';
    if (voice.includes('zh-HK') || voice.includes('yue')) return null; // 百度不支持粵語
    return 'zh';
  }

  function stop() {
    if (audioEl) {
      audioEl.onended = null;
      audioEl.onerror = null;
      audioEl.pause();
      audioEl = null;
    }
  }

  function playUrl(url) {
    return new Promise((resolve, reject) => {
      stop();
      const el = new Audio(url);
      audioEl = el;
      let settled = false;
      let started = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const bad = err => { if (!settled) { settled = true; reject(err); } };
      el.onplaying = () => { started = true; };
      el.onended = ok;
      el.onerror = () => bad(new Error('audio error'));
      setTimeout(() => { if (!started && !settled) { el.pause(); bad(new Error('timeout')); } }, 8000);
      el.play().catch(bad);
    });
  }

  async function speak(text, { voice = 'zh-CN-XiaoxiaoNeural' } = {}) {
    if (!enabled || !text) throw new Error('disabled');
    const clipped = text.slice(0, 280);

    // ① Polly（自家代理，官方接口最穩；曉曉名會映射到知語）
    if (TTS_PROXY && !proxyDown) {
      try {
        return await playUrl(`${TTS_PROXY}/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(clipped)}`);
      } catch {
        proxyDown = true; // 本次會話不再嘗試代理，直接走百度
      }
    }

    // ② 百度
    const lan = langOf(voice);
    if (!lan) {
      failures -= 1; // 語言不支持不算失敗（外層仍會 markFailure，淨值歸零）
      throw new Error('unsupported-lang');
    }
    return playUrl(`https://fanyi.baidu.com/gettts?lan=${lan}&spd=5&source=web&text=${encodeURIComponent(clipped)}`);
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
