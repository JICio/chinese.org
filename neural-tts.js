/* 雲端自然語音，三級鏈路：
   ① Amazon Polly 神經語音（經自家 Cloudflare Worker 代理，官方接口最穩）
   ② 百度翻譯發音（無需密鑰的備用線路）
   ③ 頁面內建的瀏覽器語音（最後兜底，由各頁面自己處理）
   TTS_PROXY 為空時自動跳過 ①。粵語/英文由 Worker 映射到對應聲音。 */
window.NeuralTTS = (() => {
  // 自家 Cloudflare Worker（Amazon Polly 神經語音代理）
  const TTS_PROXY = 'https://chinese-tts.lovedaocom.workers.dev';

  // 始終復用同一個 audio 元件：在首次用戶手勢裡播過一次後，
  // 之後從定時器/異步鏈發起的播放不會再被自動播放策略攔截
  let audioEl = null;
  let enabled = true;
  let failures = 0;
  // 代理失敗只冷卻 15 秒，不整場棄用：iPad 網絡抖一下不至於永遠沒聲音
  let proxyDownUntil = 0;

  function ensureEl() {
    if (!audioEl) audioEl = new Audio();
    return audioEl;
  }

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
      audioEl.onplaying = null;
      audioEl.pause();
    }
  }

  // 播放序號：舊播放被新語音頂掉後，它的一切回調（含超時器）全部作廢，
  // 不會誤暫停共享元件，也不會把「被頂掉」記成失敗
  let playSeq = 0;
  let settlePrevious = null;

  function playUrl(url) {
    return new Promise((resolve, reject) => {
      const myId = ++playSeq;
      if (settlePrevious) { settlePrevious(); settlePrevious = null; } // 被頂掉＝正常結束
      stop();
      const el = ensureEl();
      let settled = false;
      let started = false;
      const ok = () => {
        if (settled) return;
        settled = true;
        if (settlePrevious === ok) settlePrevious = null;
        resolve();
      };
      const bad = err => {
        if (settled) return;
        settled = true;
        if (settlePrevious === ok) settlePrevious = null;
        reject(err);
      };
      settlePrevious = ok;
      el.volume = 1;
      el.src = url;
      el.onplaying = () => { if (myId === playSeq) started = true; };
      el.onended = () => { if (myId === playSeq) ok(); };
      el.onerror = () => { if (myId === playSeq) bad(new Error('audio error')); };
      setTimeout(() => {
        if (myId !== playSeq) return; // 已被新語音接管，別碰共享元件
        if (!started && !settled) { el.pause(); bad(new Error('timeout')); }
      }, 8000);
      el.play().then(() => { if (myId === playSeq) started = true; })
        .catch(err => { if (myId === playSeq) bad(err); });
    });
  }

  async function speak(text, { voice = 'zh-CN-XiaoxiaoNeural' } = {}) {
    if (!enabled || !text) throw new Error('disabled');
    const clipped = text.slice(0, 280);

    // ① Polly（自家代理，官方接口最穩；曉曉名會映射到知語）
    if (TTS_PROXY && Date.now() > proxyDownUntil) {
      try {
        const done = await playUrl(`${TTS_PROXY}/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(clipped)}`);
        failures = 0; // 播放成功即恢復信用
        return done;
      } catch {
        proxyDownUntil = Date.now() + 15000; // 冷卻 15 秒後再試代理
      }
    }

    // ② 百度
    const lan = langOf(voice);
    if (!lan) {
      failures -= 1; // 語言不支持不算失敗（外層仍會 markFailure，淨值歸零）
      throw new Error('unsupported-lang');
    }
    const done = await playUrl(`https://fanyi.baidu.com/gettts?lan=${lan}&spd=5&source=web&text=${encodeURIComponent(clipped)}`);
    failures = 0;
    return done;
  }

  function markFailure() {
    failures += 1;
    if (failures >= 2) enabled = false;
  }

  // 在用戶手勢裡呼叫：用「同一個」元件播一段無聲音頻，把它標記為用戶啟動過
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    try {
      const el = ensureEl();
      if (el.src && !el.paused) return; // 正在說話就別打斷
      unlocked = true;
      el.volume = 0.05;
      el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
      el.play().catch(() => { unlocked = false; });
      // 同時在手勢裡預熱系統朗讀：iOS 要求 speechSynthesis 由用戶手勢啟動過，
      // 否則後續定時器裡的兜底朗讀會被靜音
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      }
    } catch {}
  }

  // 給頁面做預加載用：拿到某句話的代理音頻地址（代理未配置時為 null）
  function ttsUrl(text, voice = 'zh-CN-XiaoxiaoNeural') {
    if (!TTS_PROXY || !text) return null;
    return `${TTS_PROXY}/tts?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text.slice(0, 280))}`;
  }

  return { speak, stop, markFailure, unlock, ttsUrl, get enabled() { return enabled; } };
})();
