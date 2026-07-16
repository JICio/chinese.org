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
