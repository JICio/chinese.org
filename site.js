const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.primary-nav');
const languageButton = document.querySelector('[data-language-toggle]');
const translatable = document.querySelectorAll('[data-zh][data-en]');

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

let language = 'zh';

const agentExamples = {
  festival: {
    question: {
      zh: '我想向在加拿大长大的女儿解释清明节，不要只说“扫墓”。',
      en: 'I want to explain Qingming to my daughter growing up in Canada—beyond simply calling it tomb-sweeping.'
    },
    answer: {
      zh: '我会用中英双语讲清节气、祭祖与踏青的关系，标明不同地区的习俗差异，并为她生成一段可以与同学分享的短故事。',
      en: 'I’ll explain—in Chinese and English—how the solar term connects remembrance, ancestors and spring outings, note regional differences, and create a short story she can share with classmates.'
    }
  },
  family: {
    question: {
      zh: '我有一段爷爷讲开平往事的粤语录音，怎样留给下一代？',
      en: 'I have a Cantonese recording of my grandfather telling stories about Kaiping. How can I preserve it for the next generation?'
    },
    answer: {
      zh: '我会先保留原始录音，再生成粤语转写、中英文对照和人物时间线。涉及家人的私密内容会先请你确认，公开前由你决定范围。',
      en: 'I’ll preserve the original audio, then create a Cantonese transcript, Chinese-English edition and family timeline. You approve sensitive passages and decide what may be shared.'
    }
  },
  share: {
    question: {
      zh: '帮我把宋代点茶做成一段面向海外年轻人的英文短视频。',
      en: 'Help me turn Song-dynasty diancha into an English short video for young audiences overseas.'
    },
    answer: {
      zh: '我会先核对宋代文献与器物资料，再生成 60 秒英文脚本、画面建议和双语字幕，同时说明它与当代茶文化的联系与差异。',
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
      question.dataset.zh = example.question.zh;
      question.dataset.en = example.question.en;
      question.textContent = example.question[language];
    }
    if (answer) {
      answer.dataset.zh = example.answer.zh;
      answer.dataset.en = example.answer.en;
      answer.textContent = example.answer[language];
    }
  });
});

languageButton?.addEventListener('click', () => {
  language = language === 'zh' ? 'en' : 'zh';
  document.documentElement.lang = language === 'zh' ? 'zh-Hans' : 'en';
  document.body.classList.toggle('is-english', language === 'en');
  translatable.forEach(element => {
    element.textContent = element.dataset[language];
  });
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
