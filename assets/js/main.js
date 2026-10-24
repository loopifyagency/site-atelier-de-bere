/* ==========================================================================
   L’Atelier de Béré — interactions & mise en scène
   GSAP + ScrollTrigger + Lenis (embarqués dans assets/js/vendor).
   Principe : le site est lisible et fonctionnel sans animation ; tout ce qui
   est spectaculaire est ajouté par-dessus (amélioration progressive).
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const PHONE = '+33618324019';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const canAnimate = hasGsap && !reduceMotion;

  let lenis = null;
  let menuOpen = false;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ------------------------------------------------------------------------
     Outils
     ------------------------------------------------------------------------ */

  const KERN = { Vo: -0.08, Va: -0.06, Ve: -0.05, Vi: -0.04, Yo: -0.07, To: -0.07, Te: -0.06, Ta: -0.06, '’A': -0.05, At: -0.02 };

  /** Découpe un titre en mots (ou lettres) sous masque, en gardant le texte lisible par les lecteurs d’écran. */
  function splitText(el, mode = 'words') {
    if (el.dataset.splitDone) return el._targets;
    const text = el.textContent.replace(/\s+/g, ' ').trim();

    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            if (mode === 'chars') {
              let prev = '';
              Array.from(part).forEach((c) => {
                const s = document.createElement('span');
                s.className = 'ch';
                s.textContent = c;
                // l’inter-lettre est perdue quand chaque lettre est isolée : on recolle les paires usuelles
                if (KERN[prev + c]) s.style.marginLeft = `${KERN[prev + c]}em`;
                prev = c;
                wi.appendChild(s);
              });
            } else {
              wi.textContent = part;
            }
            w.appendChild(wi);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);

    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.style.display = 'contents';
    while (el.firstChild) visual.appendChild(el.firstChild);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.append(sr, visual);

    el.dataset.splitDone = '1';
    el._targets = $$(mode === 'chars' ? '.ch' : '.wi', visual);
    return el._targets;
  }

  /** Défilement vers une ancre (Lenis si actif, natif sinon). */
  function scrollToTarget(target, immediate = false) {
    if (!target) return;
    if (lenis) {
      let y = 0;
      const st = window.ScrollTrigger && target.id ? ScrollTrigger.getById(target.id) : null;
      if (target.id === 'accueil') y = 0;
      else if (st) y = st.start;
      else y = target.getBoundingClientRect().top + lenis.scroll;
      lenis.scrollTo(y, { duration: immediate ? 0 : 1.7, immediate, easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) });
    } else {
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* ------------------------------------------------------------------------
     Fonctions de base (indépendantes des animations)
     ------------------------------------------------------------------------ */

  function initYear() {
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

  /** Horaires : statut ouvert / fermé en temps réel (heure de Paris). */
  function initHours() {
    const HOURS = { 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [9, 16], 0: null };
    const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const fmt = (h) => `${h} h`;

    function parisNow() {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
          .formatToParts(new Date()).map((p) => [p.type, p.value])
      );
      return { day: WD[parts.weekday], minutes: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10) };
    }

    function status() {
      const { day, minutes } = parisNow();
      const today = HOURS[day];
      if (today && minutes >= today[0] * 60 && minutes < today[1] * 60) {
        return { open: true, day, short: 'Ouvert', long: `Ouvert maintenant · jusqu’à ${fmt(today[1])}` };
      }
      if (today && minutes < today[0] * 60) {
        return { open: false, day, short: 'Fermé', long: `Fermé · ouvre aujourd’hui à ${fmt(today[0])}` };
      }
      for (let i = 1; i <= 7; i += 1) {
        const d = (day + i) % 7;
        if (HOURS[d]) {
          const when = i === 1 ? 'demain' : DAYS[d];
          return { open: false, day, short: 'Fermé', long: `Fermé · réouverture ${when} à ${fmt(HOURS[d][0])}` };
        }
      }
      return { open: false, day, short: 'Fermé', long: 'Fermé' };
    }

    function render() {
      const s = status();
      const chip = $('[data-hours-chip]');
      if (chip) {
        chip.classList.toggle('is-open', s.open);
        $('.chip__text', chip).textContent = s.long;
      }
      const pill = $('[data-hours-status]');
      if (pill) {
        pill.textContent = s.short;
        pill.classList.toggle('is-open', s.open);
      }
      $$('.hours__table tr').forEach((tr) => tr.classList.toggle('is-today', Number(tr.dataset.day) === s.day));
    }
    render();
    setInterval(render, 60000);
  }

  /** Prépare un SMS de demande de rendez-vous (aucun envoi de données : ouverture de l’application SMS). */
  function initSms() {
    const form = $('#sms-form');
    if (!form) return;
    const preview = $('#sms-preview');
    const send = $('#sms-send');
    const copy = $('#sms-copy');
    const copyLabel = $('#sms-copy-label');
    let message = '';

    function build() {
      const name = form.elements.name.value.trim();
      const service = form.elements.service.value;
      const day = form.elements.day.value;
      const when = form.querySelector('input[name="when"]:checked').value;

      let msg = `Bonjour${name ? `, c’est ${name}` : ''} ! Je souhaiterais prendre rendez-vous`;
      msg += service ? ` pour : ${service}.` : ' (je ne sais pas encore quelle prestation choisir, pouvez-vous me conseiller ?).';
      if (day && when) msg += ` Je suis disponible le ${day}, ${when}.`;
      else if (day) msg += ` Je suis disponible le ${day}.`;
      else if (when) msg += ` Je suis plutôt disponible ${when}.`;
      else msg += ' Je suis flexible sur les horaires.';
      msg += ' Merci !';

      message = msg;
      preview.textContent = msg;
      send.setAttribute('href', `sms:${PHONE}?&body=${encodeURIComponent(msg)}`);
    }

    form.addEventListener('input', build);
    form.addEventListener('change', build);
    form.addEventListener('submit', (e) => e.preventDefault());
    build();

    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(message);
        copyLabel.textContent = 'Message copié ✓';
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = message;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); copyLabel.textContent = 'Message copié ✓'; } catch (e2) { copyLabel.textContent = 'Copie impossible'; }
        ta.remove();
      }
      setTimeout(() => { copyLabel.textContent = 'Copier le message'; }, 2200);
    });
  }

  /** FAQ en accordéon (une réponse ouverte à la fois). */
  function initFaq() {
    const items = $$('.qa');
    items.forEach((qa) => {
      const btn = $('.qa__q', qa);
      btn.addEventListener('click', () => {
        const willOpen = btn.getAttribute('aria-expanded') !== 'true';
        items.forEach((o) => {
          const b = $('.qa__q', o);
          const open = o === qa && willOpen;
          b.setAttribute('aria-expanded', String(open));
          o.classList.toggle('is-open', open);
        });
        if (hasGsap && window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 800);
      });
    });
  }

  /** Nuancier : l’ongle de gauche se transforme selon la ligne survolée ou au centre de l’écran. */
  function initPreview() {
    const pv = $('#preview');
    if (!pv) return;
    const items = $$('[data-price-list] li');
    const name = $('#pv-name');
    const price = $('#pv-price');

    // Paillettes générées (positions pseudo-aléatoires reproductibles)
    const glitter = $('#glitter');
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const colors = ['#F1E69F', '#FFFFFF', '#E4B5AD', '#E2B13C', '#FFD7E6'];
    for (let i = 0; i < 46; i += 1) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', (30 + rnd() * 160).toFixed(1));
      c.setAttribute('cy', (20 + rnd() * 260).toFixed(1));
      c.setAttribute('r', (0.9 + rnd() * 2.6).toFixed(1));
      c.setAttribute('fill', colors[Math.floor(rnd() * colors.length)]);
      c.style.animationDelay = `${(rnd() * 2.6).toFixed(2)}s`;
      c.style.animationDuration = `${(1.6 + rnd() * 2).toFixed(2)}s`;
      glitter.appendChild(c);
    }

    function setActive(li) {
      items.forEach((i) => i.classList.toggle('is-active', i === li));
      pv.dataset.style = li.dataset.style;
      name.textContent = li.dataset.name;
      price.textContent = li.dataset.price;
    }
    items.forEach((li) => {
      li.addEventListener('mouseenter', () => setActive(li));
      li.addEventListener('click', () => setActive(li));
    });
    setActive(items[0]);

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target); });
      }, { rootMargin: '-44% 0px -44% 0px' });
      items.forEach((li) => io.observe(li));
    }
  }

  /** Sections « statiques » : l’image du récit suit l’étape lue (mobile, mouvement réduit). */
  function initStoryStatic() {
    const story = $('#rituel');
    const steps = $$('.step', story);
    const phs = $$('.ph', story);
    const rail = $$('.story__rail li', story);
    let enabled = true;
    const setActive = (i) => {
      phs.forEach((p, k) => p.classList.toggle('is-active', k === i));
      rail.forEach((r, k) => { r.classList.toggle('is-active', k === i); r.classList.toggle('is-done', k < i); });
    };
    if (!('IntersectionObserver' in window)) return { setActive, enable() {}, disable() {} };
    const io = new IntersectionObserver((entries) => {
      if (!enabled) return;
      entries.forEach((e) => { if (e.isIntersecting) setActive(Number(e.target.dataset.step)); });
    }, { rootMargin: '-40% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
    return { setActive, enable() { enabled = true; }, disable() { enabled = false; } };
  }

  /** Carrousel d’avis : commandes précédent / suivant / pause, arrêt au survol et au focus. */
  function initReviews(animated) {
    const root = $('#avis');
    const slides = $$('.slide', root);
    const dots = $$('.dots li', root);
    const holder = $('#reviews-slides');
    const cur = $('#rv-cur');
    const prev = $('#rv-prev');
    const next = $('#rv-next');
    const playBtn = $('#rv-play');
    const DURATION = 8;

    let idx = 0;
    let userPaused = !animated;
    let hovering = false;
    let inView = false;
    let progress = null;

    const words = slides.map((s) => (animated ? splitText($('blockquote p', s), 'words') : []));
    if (animated) slides.forEach((s, i) => { if (i > 0) gsap.set(words[i], { yPercent: 115 }); });

    function syncPlayState() {
      const run = !userPaused && !hovering && inView && !document.hidden;
      holder.setAttribute('aria-live', run ? 'off' : 'polite');
      playBtn.setAttribute('aria-pressed', String(userPaused));
      playBtn.setAttribute('aria-label', userPaused ? 'Reprendre le défilement' : 'Mettre le défilement en pause');
      if (progress) { if (run) progress.play(); else progress.pause(); }
    }

    function startProgress() {
      if (!animated) return;
      if (progress) progress.kill();
      const bar = $('i', dots[idx]);
      progress = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: DURATION, ease: 'none', paused: true, onComplete: () => go(idx + 1) });
      syncPlayState();
    }

    function go(to) {
      const n = slides.length;
      const nextIdx = (to + n) % n;
      const out = slides[idx];
      const inn = slides[nextIdx];
      if (nextIdx === idx) return;
      const old = idx;
      idx = nextIdx;

      dots.forEach((d, k) => {
        d.classList.toggle('is-active', k === idx);
        d.classList.toggle('is-done', k < idx);
        if (animated && k !== idx) gsap.set($('i', d), { scaleX: k < idx ? 1 : 0 });
      });
      cur.textContent = String(idx + 1).padStart(2, '0');

      if (animated) {
        gsap.killTweensOf([...words[old], ...words[idx], $('figcaption', out), $('figcaption', inn)]);
        slides.forEach((s) => { if (s !== out) s.classList.remove('is-active'); });
        gsap.to(words[old], {
          yPercent: -115, duration: 0.6, ease: 'power3.in', stagger: 0.01,
          onComplete: () => { if (out !== slides[idx]) out.classList.remove('is-active'); }
        });
        gsap.to($('figcaption', out), { opacity: 0, duration: 0.35 });
        inn.classList.add('is-active');
        gsap.set(words[idx], { yPercent: 115 });
        gsap.set($('figcaption', inn), { opacity: 0, y: 16 });
        gsap.to(words[idx], { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.022, delay: 0.55 });
        gsap.to($('figcaption', inn), { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', delay: 0.9 });
        startProgress();
      } else {
        out.classList.remove('is-active');
        inn.classList.add('is-active');
      }
    }

    prev.addEventListener('click', () => go(idx - 1));
    next.addEventListener('click', () => go(idx + 1));
    playBtn.addEventListener('click', () => { userPaused = !userPaused; syncPlayState(); });
    const stage = $('.reviews__stage', root);
    stage.addEventListener('mouseenter', () => { hovering = true; syncPlayState(); });
    stage.addEventListener('mouseleave', () => { hovering = false; syncPlayState(); });
    root.addEventListener('focusin', () => { hovering = true; syncPlayState(); });
    root.addEventListener('focusout', () => { hovering = false; syncPlayState(); });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === 'ArrowRight') go(idx + 1);
    });
    document.addEventListener('visibilitychange', syncPlayState);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; syncPlayState(); }, { threshold: 0.35 }).observe(root);
    } else inView = true;

    if (animated) {
      // première diapositive : mots visibles ; progression sur le premier point
      gsap.set(words[0], { yPercent: 0 });
      startProgress();
    } else {
      playBtn.hidden = true;
    }
    syncPlayState();
  }

  /** Galerie : visionneuse plein écran accessible (élément <dialog>). */
  function initLightbox() {
    const dlg = $('#lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    const tiles = $$('[data-lightbox]');
    const img = $('#lb-img');
    const cap = $('#lb-cap');
    let cur = 0;

    function update() {
      const t = tiles[cur];
      const src = $('img', t);
      img.src = t.dataset.full;
      img.alt = src.alt;
      img.width = src.width;
      img.height = src.height;
      cap.textContent = t.dataset.caption;
    }
    function open(i) {
      cur = i;
      update();
      dlg.showModal();
      if (lenis) lenis.stop();
      if (canAnimate) gsap.fromTo($('.lightbox__fig', dlg), { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'expo.out' });
    }
    const step = (d) => { cur = (cur + d + tiles.length) % tiles.length; update(); if (canAnimate) gsap.fromTo(img, { opacity: 0, x: d * 40 }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out' }); };

    tiles.forEach((t, i) => t.addEventListener('click', () => open(i)));
    $('[data-lb-prev]', dlg).addEventListener('click', () => step(-1));
    $('[data-lb-next]', dlg).addEventListener('click', () => step(1));
    $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { if (lenis && !menuOpen) lenis.start(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /** Cache le bouton « Appeler » flottant quand l’appel à l’action est déjà à l’écran. */
  function initFab() {
    const fab = $('.fab');
    if (!fab || !('IntersectionObserver' in window)) return;
    const away = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) away.add(e.target); else away.delete(e.target); });
      fab.classList.toggle('is-away', away.size > 0 || menuOpen);
    }, { threshold: 0.2 });
    ['#rdv', '#contact', '.footer'].forEach((s) => { const el = $(s); if (el) io.observe(el); });
  }

  /** Menu mobile plein écran. */
  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    const nav = $('#nav');
    if (!burger || !menu) return;
    const links = $$('[data-menu-link]', menu);
    const inertTargets = [$('#contenu'), $('.footer'), $('.fab')].filter(Boolean);
    let tl = null;

    function setOpen(open, after) {
      menuOpen = open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      inertTargets.forEach((el) => { el.inert = open; });
      if (open) {
        menu.hidden = false;
        nav.classList.add('is-menu');
        nav.classList.remove('is-hidden');
        if (lenis) lenis.stop(); else doc.style.overflow = 'hidden';
        if (canAnimate) {
          if (tl) tl.kill();
          tl = gsap.timeline();
          tl.fromTo(menu, { yPercent: -100 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' })
            .fromTo(links, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06 }, 0.2)
            .fromTo($('.menu__foot', menu), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0.6);
        }
        links[0].focus({ preventScroll: true });
      } else {
        nav.classList.remove('is-menu');
        const done = () => {
          menu.hidden = true;
          if (lenis) lenis.start(); else doc.style.overflow = '';
          if (after) after();
        };
        if (canAnimate) {
          if (tl) tl.kill();
          tl = gsap.to(menu, { yPercent: -100, duration: 0.7, ease: 'expo.inOut', onComplete: done });
        } else done();
      }
    }

    burger.addEventListener('click', () => setOpen(!menuOpen));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setOpen(false); burger.focus(); } });
    links.forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = $(a.getAttribute('href'));
      setOpen(false, () => scrollToTarget(target, !lenis && reduceMotion));
    }));
    window.addEventListener('resize', () => { if (menuOpen && window.innerWidth > 1100) setOpen(false); });
  }

  /** Liens d’ancre : défilement fluide. */
  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-menu-link')) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
      history.pushState(null, '', id);
    });
  }

  /* ------------------------------------------------------------------------
     Scroll : barre de progression + en-tête qui se cache / réapparaît
     ------------------------------------------------------------------------ */
  function initScrollUi(addScrollListener) {
    const nav = $('#nav');
    const bar = $('.progress__bar');
    let last = 0;
    addScrollListener((y, limit) => {
      bar.style.transform = `scaleX(${limit > 0 ? Math.min(1, y / limit) : 0})`;
      nav.classList.toggle('is-solid', y > 40);
      if (menuOpen) return;
      const delta = y - last;
      if (Math.abs(delta) < 6) return;
      if (y > 480 && delta > 0) nav.classList.add('is-hidden');
      else if (delta < 0 || y <= 480) nav.classList.remove('is-hidden');
      last = y;
    });
  }

  /* ------------------------------------------------------------------------
     Mise en scène animée
     ------------------------------------------------------------------------ */

  function setupSmoothScroll() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /** Préchargeur : l’ongle se remplit de vernis, puis deux rideaux se lèvent. */
  function runLoader() {
    const loader = $('#loader');
    return new Promise((resolve) => {
      const fill = $('.loader__fill', loader);
      const count = $('#loader-count', loader);
      const shine = $('.loader__shine', loader);
      gsap.set(fill, { y: 300 });
      gsap.set(shine, { opacity: 0 });

      const ready = Promise.race([
        Promise.all([
          document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
          document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }))
        ]),
        new Promise((r) => setTimeout(r, 4500))
      ]);

      const fillTween = gsap.to(fill, {
        y: 0, duration: 2, ease: 'power2.inOut',
        onUpdate() { count.textContent = String(Math.round(this.ratio * 100)); }
      });
      gsap.to(shine, { opacity: 0.55, duration: 0.8, delay: 1.2 });
      gsap.fromTo($('.loader__name', loader), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', delay: 0.2 });

      Promise.all([ready, new Promise((r) => fillTween.eventCallback('onComplete', r))]).then(() => {
        count.textContent = '100';
        const lift = window.innerHeight * 0.18 + 160;
        const exit = gsap.timeline({ onComplete: () => { loader.remove(); } });
        exit.to($('.loader__inner', loader), { y: -50, opacity: 0, duration: 0.55, ease: 'power3.in' })
          .to($('.loader__curtain--front', loader), { yPercent: -100, y: -lift, duration: 1.25, ease: 'expo.inOut' }, '>-0.05')
          .to($('.loader__curtain--back', loader), { yPercent: -100, y: -lift, duration: 1.25, ease: 'expo.inOut' }, '<0.14');
        resolve({ exit }); // objet englobant : une timeline GSAP est « thenable » et serait attendue par la promesse
      });
    });
  }

  function prepareHero() {
    const hero = $('.hero');
    const title = splitText($('[data-hero-title]'), 'chars');
    gsap.set(title, { yPercent: 125, rotate: 7 });
    gsap.set([$('.hero .kicker'), ...$$('[data-hero-fade]')], { opacity: 0, y: 34 });
    gsap.set($$('[data-hero-frame]'), { opacity: 0, scale: 0.55, y: 140 });
    gsap.set($('.hl--ghost .hl__in', hero), { opacity: 0 });
    gsap.set($$('.hl--blob .hl__in, .hl--ring .hl__in', hero), { opacity: 0, scale: 0.7 });
    gsap.set($$('.hero__fg .hl__in', hero), { opacity: 0, scale: 0.2 });
    gsap.set($('.scrollcue'), { opacity: 0 });
    gsap.set([$('.nav__brand'), ...$$('.nav__links a'), $('.nav__right')], { opacity: 0, y: -24 });

    return function playHero() {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to($$('.hl--blob .hl__in, .hl--ring .hl__in', hero), { opacity: 1, scale: 1, duration: 2.4, stagger: 0.15 }, 0)
        .to($('.hl--ghost .hl__in', hero), { opacity: 1, duration: 2.4 }, 0.2)
        .to(title, { yPercent: 0, rotate: 0, duration: 1.6, stagger: 0.032 }, 0.15)
        .to($('.hero .kicker'), { opacity: 1, y: 0, duration: 1.2 }, 0.2)
        .to($$('[data-hero-fade]'), { opacity: 1, y: 0, duration: 1.3, stagger: 0.12 }, 0.7)
        .to($$('[data-hero-frame]'), { opacity: 1, scale: 1, y: 0, duration: 2, stagger: 0.18 }, 0.25)
        .to($$('.hero__fg .hl__in', hero), { opacity: 1, scale: 1, duration: 1.8, stagger: 0.12, ease: 'elastic.out(1, 0.6)' }, 1)
        .to([$('.nav__brand'), ...$$('.nav__links a'), $('.nav__right')], { opacity: 1, y: 0, duration: 1.1, stagger: 0.05 }, 0.9)
        .to($('.scrollcue'), { opacity: 1, duration: 1 }, 1.4);
      return tl;
    };
  }

  function initHeroMotion() {
    const hero = $('.hero');

    // Parallaxe multicouche au scroll (vitesse en % de la hauteur du hero)
    $$('.hl[data-speed]', hero).forEach((el) => {
      gsap.to(el, {
        y: () => (parseFloat(el.dataset.speed) * hero.offsetHeight) / 100,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
      });
    });

    // Parallaxe à la souris
    if (finePointer) {
      const layers = $$('.hl__in[data-depth]', hero).map((el) => ({
        depth: parseFloat(el.dataset.depth),
        x: gsap.quickTo(el, 'x', { duration: 1.4, ease: 'power3.out' }),
        y: gsap.quickTo(el, 'y', { duration: 1.4, ease: 'power3.out' })
      }));
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        layers.forEach((l) => { l.x(-nx * l.depth); l.y(-ny * l.depth); });
      });
      hero.addEventListener('pointerleave', () => layers.forEach((l) => { l.x(0); l.y(0); }));
    }
  }

  /** Bandeaux défilants dont la vitesse et le sens suivent le scroll. */
  function initMarquee() {
    const bands = $$('[data-marquee]');
    const items = bands.map((band) => {
      const track = $('.marquee__track', band);
      const group = $('.marquee__group', track);
      // assez de copies pour couvrir l’écran, puis une copie de plus pour la boucle
      const need = Math.ceil((window.innerWidth * 1.3) / Math.max(1, group.scrollWidth)) + 1;
      for (let i = 0; i < Math.max(1, need); i += 1) {
        const c = group.cloneNode(true);
        track.appendChild(c);
      }
      const dir = Number(band.dataset.marquee);
      const copies = track.children.length;
      const shift = -100 / copies; // un groupe entier : boucle sans couture
      const tween = gsap.fromTo(track, { xPercent: dir > 0 ? 0 : shift }, {
        xPercent: dir > 0 ? shift : 0,
        ease: 'none', duration: 22, repeat: -1
      });
      return { tween, dir };
    });

    let scale = 1;
    let flow = 1;
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => { if (self.direction) flow = self.direction; }
    });
    gsap.ticker.add(() => {
      const v = lenis ? Math.abs(lenis.velocity) : 0;
      const target = flow * (1 + Math.min(v * 0.55, 9));
      scale += (target - scale) * 0.08;
      items.forEach((it) => it.tween.timeScale(scale));
    });
  }

  /** Récit « le rituel » : épinglé sur bureau, sticky sur mobile. */
  function initStory(mm, storyStatic) {
    const story = $('#rituel');
    const steps = $$('.step', story);
    const phs = $$('.ph', story);
    const rail = $$('.story__rail li', story);

    mm.add('(min-width: 900px)', () => {
      story.classList.add('is-pinned');
      storyStatic.disable();

      gsap.set(steps.slice(1), { autoAlpha: 0, y: 50 });
      gsap.set(phs.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
      const inners = phs.map((p) => $('.ph__in', p));
      gsap.set(inners.slice(1), { scale: 1.35, yPercent: 8 });

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          id: 'rituel', trigger: story, start: 'top top', end: '+=300%', pin: true, scrub: 0.7, anticipatePin: 1,
          onUpdate: () => {
            const i = Math.min(3, Math.floor(tl.time() + 0.2));
            rail.forEach((r, k) => { r.classList.toggle('is-active', k === i); r.classList.toggle('is-done', k < i); });
          }
        }
      });
      for (let i = 1; i < 4; i += 1) {
        tl.to(steps[i - 1], { autoAlpha: 0, y: -50, duration: 0.35 }, i - 0.35)
          .fromTo(steps[i], { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.45 }, i - 0.08)
          .to(phs[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.65, ease: 'power3.inOut' }, i - 0.38)
          .to(inners[i], { scale: 1, yPercent: 0, duration: 0.95, ease: 'power2.out' }, i - 0.38);
      }
      tl.to({}, { duration: 0.35 });
      rail[0].classList.add('is-active');

      // Ken Burns lent sur les photos
      const kb = gsap.to($$('img', story).slice(0, 4), { scale: 1.09, duration: 14, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 2 });

      return () => { story.classList.remove('is-pinned'); kb.kill(); storyStatic.enable(); };
    });

    mm.add('(max-width: 899px)', () => {
      // simple : l’image sticky change avec l’étape lue (géré par IntersectionObserver)
      storyStatic.enable();
      storyStatic.setActive(0);
    });
  }

  /** Zone qui défile horizontalement au doigt : atteignable et utilisable au clavier. */
  function markScrollable(track, on) {
    if (on) {
      track.tabIndex = 0;
      track.setAttribute('role', 'region');
      track.setAttribute('aria-label', 'Prestations et tarifs, à faire défiler horizontalement');
    }
    return () => { track.removeAttribute('tabindex'); track.removeAttribute('role'); track.removeAttribute('aria-label'); };
  }

  /** La carte : défilement horizontal piloté par le scroll vertical (bureau) ; ruban natif au doigt (mobile). */
  function initCards(mm) {
    const section = $('#carte');
    const track = $('.cards__track', section);
    const cards = $$('.card', section);
    const barFill = $('.cards__progress span', section);

    mm.add('(max-width: 899px)', () => markScrollable(track, true));

    mm.add('(min-width: 900px)', () => {
      section.classList.add('is-pinned');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);

      const move = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          id: 'carte', trigger: section, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: (self) => { barFill.style.transform = `scaleX(${self.progress})`; }
        }
      });

      cards.forEach((card) => {
        gsap.fromTo(card, { opacity: 0.2, scale: 0.9 }, {
          opacity: 1, scale: 1, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: move, start: 'left 105%', end: 'left 62%', scrub: true }
        });
        gsap.fromTo($('.swatch', card), { rotate: -28, y: 40 }, {
          rotate: 0, y: 0, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: move, start: 'left 100%', end: 'left 50%', scrub: true }
        });
        gsap.fromTo($('.card__price .num', card), { y: 50, opacity: 0 }, {
          y: 0, opacity: 1, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: move, start: 'left 90%', end: 'left 55%', scrub: true }
        });
      });
      return () => { section.classList.remove('is-pinned'); barFill.style.transform = ''; };
    });
  }

  /** Révélations génériques : titres par mots, blocs qui montent, listes qui s’égrènent. */
  function initReveals() {
    // Titres : mots sous masque
    $$('[data-split]').forEach((el) => {
      const targets = splitText(el, el.dataset.split || 'words');
      gsap.set(targets, { yPercent: 118 });
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(targets, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.05 })
      });
    });

    // Blocs qui montent (par lots, avec décalage)
    const sel = [
      '.story__head .kicker', '.cards__intro .kicker', '.cards__lead', '.cards__hint', '.artbar__head .kicker', '.artbar__lead',
      '.stats__head .kicker', '.gallery__head .kicker', '.gallery__lead', '.reviews__head .kicker', '.faq__head .kicker', '.faq__lead',
      '.cta .kicker', '.cta__lead', '.cta__phone', '.cta__row', '.find__info .kicker', '.find__line', '.hours',
      '.menu-title', '.artbar__note', '.qa', '.stat', '.sms', '.footer__tag', '.footer__cols > div', '.reviews__ctrl'
    ];
    const els = $$(sel.join(','));
    gsap.set(els, { opacity: 0, y: 44 });
    ScrollTrigger.batch(els, {
      start: 'top 91%', once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.25, ease: 'expo.out', stagger: 0.09, overwrite: true })
    });

    // Lignes de prix : le pointillé se trace
    $$('.price-list li').forEach((li) => {
      const dots = $('.price-list__dots', li);
      gsap.set(dots, { scaleX: 0 });
      gsap.set(li, { opacity: 0, y: 30 });
      ScrollTrigger.create({
        trigger: li, start: 'top 92%', once: true,
        onEnter: () => {
          gsap.to(li, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' });
          gsap.to(dots, { scaleX: 1, duration: 1.4, ease: 'expo.out', delay: 0.15 });
        }
      });
    });

    // Séparateurs « smile line » : la courbe se dessine
    $$('.smile').forEach((sm) => {
      const fill = $('.smile__fill', sm);
      const tip = $('.smile__tip', sm);
      gsap.set(fill, { scaleY: 0.02, transformOrigin: '50% 0%' });
      gsap.set(tip, { opacity: 0 });
      ScrollTrigger.create({
        trigger: sm, start: 'top 98%', once: true,
        onEnter: () => {
          gsap.to(fill, { scaleY: 1, duration: 1.6, ease: 'expo.out' });
          gsap.to(tip, { opacity: 1, duration: 1.2, delay: 0.5 });
        }
      });
    });
  }

  /** Chiffres clés : compteurs + contour d’ongle qui se trace. */
  function initStats() {
    $$('.stat').forEach((stat) => {
      const num = $('[data-count]', stat);
      const end = Number(num.dataset.count);
      const state = { v: 0 };
      num.textContent = '0';
      const path = $('.stat__ring path', stat);
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      ScrollTrigger.create({
        trigger: stat, start: 'top 85%', once: true,
        onEnter: () => {
          gsap.to(state, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { num.textContent = String(Math.round(state.v)); } });
          gsap.to(path, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut' });
        }
      });
    });
  }

  /** Galerie : rideau de révélation, parallaxe décalée, inclinaison 3D. */
  function initGallery(mm) {
    $$('.tile').forEach((tile) => {
      const shape = $('.tile__shape', tile);
      if (shape) {
        const curtain = document.createElement('span');
        curtain.setAttribute('aria-hidden', 'true');
        curtain.style.cssText = 'position:absolute;inset:-1px;z-index:2;background:var(--milk);transform-origin:50% 0;';
        shape.appendChild(curtain);
        const img = $('img', shape);
        gsap.set(img, { scale: 1.5 });
        ScrollTrigger.create({
          trigger: tile, start: 'top 88%', once: true,
          onEnter: () => {
            gsap.to(curtain, { scaleY: 0, duration: 1.5, ease: 'expo.inOut' });
            gsap.to(img, { scale: 1.08, duration: 2.2, ease: 'expo.out' });
          }
        });
        const cap = $('.tile__cap', tile);
        if (cap) cap.style.willChange = 'transform';
      } else {
        gsap.set(tile, { opacity: 0 });
        ScrollTrigger.create({ trigger: tile, start: 'top 90%', once: true, onEnter: () => gsap.to(tile, { opacity: 1, duration: 1.4, ease: 'expo.out' }) });
      }
    });

    mm.add('(min-width: 900px)', () => {
      $$('.tile[data-speed]').forEach((tile) => {
        const s = parseFloat(tile.dataset.speed);
        gsap.fromTo(tile, { y: s * 420 }, {
          y: -s * 420, ease: 'none',
          scrollTrigger: { trigger: tile, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    });
  }

  /** Inclinaison 3D + reflet lumineux qui suit la souris. */
  function initTilt() {
    if (!finePointer) return;
    $$('[data-tilt]').forEach((el) => {
      const target = $('.tile__shape', el) || el;
      gsap.set(target, { transformPerspective: 900 });
      const rx = gsap.quickTo(target, 'rotationX', { duration: 0.7, ease: 'power3.out' });
      const ry = gsap.quickTo(target, 'rotationY', { duration: 0.7, ease: 'power3.out' });
      const isTile = el.classList.contains('tile');
      // quickTo n’accepte pas « scale » (raccourci) : on utilise un tween classique, limité à cette propriété
      const sc = isTile ? (v) => gsap.to(target, { scale: v, duration: 0.8, ease: 'power3.out', overwrite: 'auto' }) : null;
      el.addEventListener('pointerenter', () => { if (sc) sc(1.035); });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 16);
        rx(-(py - 0.5) * 16);
        el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); if (sc) sc(1); });
    });
  }

  /** Boutons magnétiques. */
  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((btn) => {
      const label = $('.btn__label', btn);
      const bx = gsap.quickTo(btn, 'x', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
      const by = gsap.quickTo(btn, 'y', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
      const lx = label ? gsap.quickTo(label, 'x', { duration: 0.9, ease: 'elastic.out(1, 0.45)' }) : null;
      const ly = label ? gsap.quickTo(label, 'y', { duration: 0.9, ease: 'elastic.out(1, 0.45)' }) : null;
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        bx(dx * 0.26); by(dy * 0.38);
        if (lx) { lx(dx * 0.1); ly(dy * 0.16); }
      });
      btn.addEventListener('pointerleave', () => { bx(0); by(0); if (lx) { lx(0); ly(0); } });
    });
  }

  /** Curseur personnalisé (souris uniquement). */
  function initCursor() {
    if (!finePointer) return;
    const c = $('.cursor');
    const label = $('.cursor__label', c);
    doc.classList.add('has-cursor');
    const xTo = gsap.quickTo(c, 'x', { duration: 0.45, ease: 'power3.out' });
    const yTo = gsap.quickTo(c, 'y', { duration: 0.45, ease: 'power3.out' });
    window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); c.classList.add('is-on'); }, { passive: true });
    doc.addEventListener('mouseleave', () => c.classList.remove('is-on'));
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, [data-cursor], input, select, label, summary');
      const kind = t ? t.dataset.cursor : null;
      c.classList.toggle('is-view', kind === 'view' || kind === 'view-map');
      c.classList.toggle('is-link', !!t && kind !== 'view' && kind !== 'view-map' && kind !== 'card');
      if (kind === 'view') label.textContent = 'Voir';
      if (kind === 'view-map') label.textContent = 'Ouvrir';
    });
  }

  /** Divers effets de section : CTA, carte, pied de page. */
  function initSectionFx(mm) {
    // Rendez-vous : orbes en dérive + badge qui apparaît
    gsap.fromTo('.cta__orb--1', { y: -80 }, { y: 140, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.cta__orb--2', { y: 120 }, { y: -160, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });

    // Carte : rideau en forme d’arche
    const map = $('.mapframe');
    gsap.set(map, { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 36px 36px)' });
    gsap.set($('iframe', map), { scale: 1.3 });
    ScrollTrigger.create({
      trigger: map, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(map, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 36px 36px)', duration: 1.8, ease: 'expo.inOut' });
        gsap.to($('iframe', map), { scale: 1, duration: 2.4, ease: 'expo.out' });
      }
    });
    $$('.hours__table tr').forEach((tr) => gsap.set(tr, { opacity: 0, x: -26 }));
    ScrollTrigger.batch('.hours__table tr', {
      start: 'top 94%', once: true,
      onEnter: (b) => gsap.to(b, { opacity: 1, x: 0, duration: 1, ease: 'expo.out', stagger: 0.07 })
    });

    // Pied de page : nom géant ajusté à la largeur, lettres qui montent
    const giant = $('[data-footer-giant]');
    const fit = () => {
      const measure = document.createElement('span');
      measure.textContent = $('.sr-only', giant).textContent;
      measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit;';
      giant.appendChild(measure);
      const cs = getComputedStyle(giant);
      const avail = giant.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const w = measure.getBoundingClientRect().width;
      measure.remove();
      if (w > 0) giant.style.fontSize = `${(parseFloat(cs.fontSize) * avail / w * 0.985).toFixed(2)}px`;
    };
    const chars = splitText(giant, 'chars');
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { giant.style.fontSize = ''; fit(); });
    window.addEventListener('load', () => { giant.style.fontSize = ''; fit(); });
    gsap.set(chars, { yPercent: 120 });
    ScrollTrigger.create({
      trigger: giant, start: 'top 95%', once: true,
      onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.7, ease: 'expo.out', stagger: 0.045 })
    });
    let rz;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { giant.style.fontSize = ''; fit(); }, 150); });
  }

  /* ------------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------------ */
  function boot() {
    initYear();
    initHours();
    initSms();
    initFaq();
    initPreview();
    initLightbox();
    initFab();
    initMenu();
    initAnchors();
    const storyStatic = initStoryStatic();

    if (!canAnimate) {
      // Version sans animation : lecture directe, aucun préchargeur.
      doc.classList.add('is-static');
      const loader = $('#loader');
      if (loader) loader.remove();
      initScrollUi((cb) => {
        const onScroll = () => cb(window.scrollY, doc.scrollHeight - window.innerHeight);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      });
      initReviews(false);
      markScrollable($('#carte .cards__track'), true);
      storyStatic.setActive(0);
      return;
    }

    setupSmoothScroll();
    window.scrollTo(0, 0);

    initScrollUi((cb) => {
      lenis.on('scroll', ({ scroll, limit }) => cb(scroll, limit));
    });

    const playHero = prepareHero();
    const mm = gsap.matchMedia();

    initReveals();
    initStats();
    initMarquee();
    initStory(mm, storyStatic);
    initCards(mm);
    initGallery(mm);
    initSectionFx(mm);
    initHeroMotion();
    initTilt();
    initMagnetic();
    initCursor();
    initReviews(true);

    runLoader().then(({ exit }) => {
      exit.add(() => {
        playHero();
        lenis.start();
      }, '-=0.75');
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', () => setTimeout(refresh, 200));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(refresh, 100));
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(refresh, 250); });
  }

  boot();
})();
