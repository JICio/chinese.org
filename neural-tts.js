/* 雲端自然語音，三級鏈路：
   ① Azure 神經語音（曉曉等，經自家 Cloudflare Worker 代理，官方接口最穩）
   ② 百度翻譯發音（無需密鑰的備用線路）
   ③ 頁面內建的瀏覽器語音（最後兜底，由各頁面自己處理）
   AZURE_PROXY 為空時自動跳過 ①。 */
window.NeuralTTS = (() => {
  // 部署 cf-worker 後填入，如 'https://chinese-tts.<你的子域>.workers.dev'
  const AZURE_PROXY = '';

  let audioEl = null;
  let enabled = true;
  let failures = 0;
  let azureDown = false;

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

    // ① Azure（代理已配置且未標記故障時）
    if (AZURE_PROXY && !azureDown) {
      try {
        return await playUrl(`${AZURE_PROXY}/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(clipped)}`);
      } catch {
        azureDown = true; // 本次會話不再嘗試 Azure，直接走百度
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
