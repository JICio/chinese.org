const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.primary-nav');
const languageButtons = document.querySelectorAll('[data-language-option]');
const translatable = document.querySelectorAll('[data-zht][data-zhs][data-en]');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav?.classList.toggle('is-open', !isOpen);
});

nav?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  });
});

let language = 'zht';

const agentExamples = {
  festival: {
    question: {
      zht: '我想向在加拿大長大的女兒解釋清明節，不要只說“掃墓”。',
      zhs: '我想向在加拿大长大的女儿解释清明节，不要只说“扫墓”。',
      en: 'I want to explain Qingming to my daughter growing up in Canada—beyond simply calling it tomb-sweeping.'
    },
    answer: {
      zht: '我會用中英雙語講清節氣、祭祖與踏青的關係，標明不同地區的習俗差異，並為她生成一段可以與同學分享的短故事。',
      zhs: '我会用中英双语讲清节气、祭祖与踏青的关系，标明不同地区的习俗差异，并为她生成一段可以与同学分享的短故事。',
      en: 'I’ll explain—in Chinese and English—how the solar term connects remembrance, ancestors and spring outings, note regional differences, and create a short story she can share with classmates.'
    }
  },
  family: {
    question: {
      zht: '我有一段爺爺講開平往事的粵語錄音，怎樣留給下一代？',
      zhs: '我有一段爷爷讲开平往事的粤语录音，怎样留给下一代？',
      en: 'I have a Cantonese recording of my grandfather telling stories about Kaiping. How can I preserve it for the next generation?'
    },
    answer: {
      zht: '我會先保留原始錄音，再生成粵語轉寫、中英文對照和人物時間線。涉及家人的私密內容會先請你確認，公開前由你決定範圍。',
      zhs: '我会先保留原始录音，再生成粤语转写、中英文对照和人物时间线。涉及家人的私密内容会先请你确认，公开前由你决定范围。',
      en: 'I’ll preserve the original audio, then create a Cantonese transcript, Chinese-English edition and family timeline. You approve sensitive passages and decide what may be shared.'
    }
  },
  share: {
    question: {
      zht: '幫我把宋代點茶做成一段面向海外年輕人的英文短影片。',
      zhs: '帮我把宋代点茶做成一段面向海外年轻人的英文短视频。',
      en: 'Help me turn Song-dynasty diancha into an English short video for young audiences overseas.'
    },
    answer: {
      zht: '我會先核對宋代文獻與器物資料，再生成 60 秒英文指令碼、畫面建議和雙語字幕，同時說明它與當代茶文化的聯絡與差異。',
      zhs: '我会先核对宋代文献与器物资料，再生成 60 秒英文脚本、画面建议和双语字幕，同时说明它与当代茶文化的联系与差异。',
      en: 'I’ll check Song-period texts and objects, then create a 60-second English script, visual plan and bilingual captions—clearly separating historical practice from modern tea culture.'
    }
  }
};

document.querySelectorAll('[data-agent-example]').forEach(button => {
  button.addEventListener('click', () => {
    const example = agentExamples[button.dataset.agentExample];
    if (!example) return;

    document.querySelectorAll('[data-agent-example]').forEach(option => {
      const isActive = option === button;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-pressed', String(isActive));
    });

    const question = document.querySelector('.agent-question');
    const answer = document.querySelector('.agent-answer');
    if (question) {
      question.dataset.zht = example.question.zht;
      question.dataset.zhs = example.question.zhs;
      question.dataset.en = example.question.en;
      question.textContent = example.question[language];
    }
    if (answer) {
      answer.dataset.zht = example.answer.zht;
      answer.dataset.zhs = example.answer.zhs;
      answer.dataset.en = example.answer.en;
      answer.textContent = example.answer[language];
    }
  });
});

const pageMetadata = {
  zht: {
    title: 'Chinese.org — 每個華人的文化智能體',
    description: 'Chinese.org 為每個華人打造一個屬於自己的文化智能體，理解個人的文化根脈，基於可查證的知識，用多語言向世界傳播華夏文明。'
  },
  zhs: {
    title: 'Chinese.org — 每个华人的文化智能体',
    description: 'Chinese.org 为每个华人打造一个属于自己的文化智能体，理解个人的文化根脉，基于可查证的知识，用多语言向世界传播华夏文明。'
  },
  en: {
    title: 'Chinese.org — A culture agent for every Chinese person',
    description: 'A personal AI culture agent that understands your roots and helps you share Chinese civilization with the world through verifiable, multilingual knowledge.'
  }
};

function applyLanguage(nextLanguage) {
  language = nextLanguage;
  const languageCodes = { zht: 'zh-Hant', zhs: 'zh-Hans', en: 'en' };
  document.documentElement.lang = languageCodes[language];
  document.body.classList.toggle('is-english', language === 'en');
  translatable.forEach(element => {
    element.textContent = element.dataset[language];
  });
  languageButtons.forEach(button => {
    const isActive = button.dataset.languageOption === language;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  document.title = pageMetadata[language].title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', pageMetadata[language].description);
}

languageButtons.forEach(button => {
  button.addEventListener('click', () => applyLanguage(button.dataset.languageOption));
});

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

document.querySelectorAll('.section, .origin-note').forEach(section => {
  section.classList.add('reveal');
  if (revealObserver) revealObserver.observe(section);
  else section.classList.add('is-visible');
});
