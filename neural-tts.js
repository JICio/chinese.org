/* 雲端自然語音：百度翻譯發音接口（大陸訪問快、無需密鑰、任意文本）。
   非官方端點；連續失敗兩次自動停用，回退瀏覽器語音。
   粵語不支持（自動回退），英文走 lan=en。 */
window.NeuralTTS = (() => {
  let audioEl = null;
  let enabled = true;
  let failures = 0;

  function langOf(voice) {
    if (!voice) return 'zh';
    if (voice.includes('en-US')) return 'en';
    if (voice.includes('zh-HK') || voice.includes('yue')) return null; // 不支持
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

  function speak(text, { voice } = {}) {
    return new Promise((resolve, reject) => {
      if (!enabled || !text) { reject(new Error('disabled')); return; }
      const lan = langOf(voice);
      if (!lan) {
        failures -= 1; // 語言不支持不算失敗（外層仍會 markFailure，淨值歸零）
        reject(new Error('unsupported-lang'));
        return;
      }
      stop();
      const clipped = text.slice(0, 280);
      const el = new Audio(`https://fanyi.baidu.com/gettts?lan=${lan}&spd=5&source=web&text=${encodeURIComponent(clipped)}`);
      audioEl = el;
      let settled = false;
      let started = false;
      const ok = () => { if (!settled) { settled = true; resolve(); } };
      const bad = err => { if (!settled) { settled = true; reject(err); } };
      el.onplaying = () => { started = true; };
      el.onended = ok;
      el.onerror = () => bad(new Error('audio error'));
      // 8 秒還沒開始播放就放棄（網絡不通/被攔截）
      setTimeout(() => { if (!started && !settled) { el.pause(); bad(new Error('timeout')); } }, 8000);
      // 播放被自動播放策略拒絕時 reject → 外層回退
      el.play().catch(bad);
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
