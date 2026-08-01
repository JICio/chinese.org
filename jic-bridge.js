(() => {
  const U = 'https://u.jic.io';
  const host = document.querySelector('#jic-account');
  const accountButton = host?.querySelector('.jic-account-button');
  let resolvedName = null;
  let resolvedFor = null;
  let dragonAttempts = 0;

  function isEnglish() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('en');
  }

  function isSimplified() {
    const lang = (document.documentElement.lang || '').toLowerCase();
    return lang.includes('hans') || lang === 'zh-cn' || lang === 'zh-sg';
  }

  function words() {
    if (isEnglish()) {
      return {
        login: 'JIC in',
        loginTitle: 'One account across Chinese.org and JIC',
        cabinTitle: 'Open my JIC command cabin',
        dragonTitle: 'My culture-agent dragon · Open JIC cabin'
      };
    }
    if (isSimplified()) {
      return {
        login: '登录 JIC',
        loginTitle: '一个账号通行 Chinese.org 与 JIC',
        cabinTitle: '进入我的 JIC 指挥舱',
        dragonTitle: '我的文化智能体小龙 · 进入 JIC 指挥舱'
      };
    }
    return {
      login: '登入 JIC',
      loginTitle: '一個帳號通行 Chinese.org 與 JIC',
      cabinTitle: '進入我的 JIC 指揮艙',
      dragonTitle: '我的文化智能體小龍 · 進入 JIC 指揮艙'
    };
  }

  function shortIdentity(value) {
    const text = String(value || '');
    return text.length > 14 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
  }

  function loginFallback() {
    const redirect = location.href.split('#')[0].split('?')[0];
    location.href = `${U}/login?redirect_uri=${encodeURIComponent(redirect)}&site=${encodeURIComponent(location.host)}`;
  }

  function currentUser() {
    return window.JIC?.loggedIn?.() ? window.JIC.user() : null;
  }

  async function resolveHandle(user) {
    if (!user?.sub || user.sub === resolvedFor) return;
    resolvedFor = user.sub;
    resolvedName = null;
    try {
      const response = await fetch(`${U}/v1/handle/${encodeURIComponent(user.sub)}`);
      const data = await response.json();
      if (resolvedFor === user.sub && data?.name) {
        resolvedName = data.name;
        renderAccount();
      }
    } catch (_) {
      // The wallet identity still works when the optional short-name lookup is offline.
    }
  }

  function renderAccount() {
    if (!accountButton) return;
    const copy = accountButton.querySelector('.jic-account-copy');
    const user = currentUser();
    const text = words();
    const authenticated = !!user;

    accountButton.classList.toggle('is-authenticated', authenticated);
    accountButton.setAttribute('aria-pressed', String(authenticated));

    if (authenticated) {
      const identity = resolvedName ? `@${resolvedName}` : shortIdentity(user.sub);
      if (copy) copy.textContent = identity;
      accountButton.title = text.cabinTitle;
      accountButton.setAttribute('aria-label', `${text.cabinTitle} · ${identity}`);
      accountButton.onclick = () => { location.href = `${U}/u`; };
      resolveHandle(user);
    } else {
      resolvedName = null;
      resolvedFor = null;
      if (copy) copy.textContent = text.login;
      accountButton.title = text.loginTitle;
      accountButton.setAttribute('aria-label', text.loginTitle);
      accountButton.onclick = () => window.JIC?.login?.() || loginFallback();
    }
  }

  function brandDragon() {
    const button = document.querySelector('#jic-w .alien');
    if (!button) {
      if (dragonAttempts++ < 80) window.setTimeout(brandDragon, 100);
      return;
    }

    if (!button.querySelector('img')) {
      button.replaceChildren();
      const dragon = document.createElement('img');
      dragon.src = 'assets/jic-dragon.svg';
      dragon.alt = '';
      dragon.setAttribute('aria-hidden', 'true');
      button.appendChild(dragon);
    }
    button.classList.add('jic-dragon');
    button.title = words().dragonTitle;
    button.setAttribute('aria-label', words().dragonTitle);
  }

  function refresh() {
    renderAccount();
    brandDragon();
  }

  window.addEventListener('jic:auth', refresh);
  window.addEventListener('storage', event => {
    if (event.key === 'jic_jwt') refresh();
  });
  window.addEventListener('chinese:language', refresh);

  window.ChineseJIC = {
    refresh,
    login: () => window.JIC?.login?.() || loginFallback(),
    logout: () => {
      window.JIC?.logout?.();
      refresh();
    }
  };

  refresh();
})();
