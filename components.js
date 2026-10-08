/* Job Signal Board — reusable Web Components.
   Light DOM, dependency-free, presentation only: never touches data files.
   Shared helpers and the gamification layer live on window.JB so app.js
   and the components stay in sync. All localStorage keys are unchanged. */
(function () {
  'use strict';

  const esc = (value) => String(value === undefined || value === null ? '' : value)
    .replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]);

  const normCompany = (name) => String(name).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-');

  /* ---------- Rarity (display badges only, derived from company name) ---------- */
  const RARITY_MAP = {
    legendary: ['databricks', 'nvidia', 'jane-street', 'citadel-securities', 'hrt', 'two-sigma', 'anthropic', 'openai'],
    epic: ['google', 'meta', 'apple', 'netflix', 'tesla', 'snowflake', 'stripe', 'datadog'],
    rare: ['microsoft', 'amazon', 'tiktok', 'figma', 'cloudflare', 'coinbase', 'akuna-capital'],
  };
  const RARITY_LABEL = { legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common' };
  const rarityOf = (company) => {
    const n = normCompany(company);
    if (RARITY_MAP.legendary.includes(n)) return 'legendary';
    if (RARITY_MAP.epic.includes(n)) return 'epic';
    if (RARITY_MAP.rare.includes(n)) return 'rare';
    return 'common';
  };

  /* ---------- Shiny: comp at or above $200K, parsed from existing text only ---------- */
  const maxCompValue = (text) => {
    if (!text) return 0;
    if (/\/(hr|hour)\b/i.test(text)) return 0;
    let max = 0;
    const re = /\$([\d,]+(?:\.\d+)?)(?:\s*[\-\u2013\u2014]\s*([\d,]+(?:\.\d+)?))?\s*([Kk])?/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const k = m[3] ? 1000 : 1;
      const v1 = parseFloat(m[1].replace(/,/g, '')) * k;
      const v2 = m[2] ? parseFloat(m[2].replace(/,/g, '')) * k : 0;
      if (v1 > max) max = v1;
      if (v2 > max) max = v2;
    }
    return max;
  };

  /* ---------- XP + levels (localStorage, per-role max milestones) ---------- */
  const XP_KEY = 'job-signal-xp';
  const XP_AWARDS_KEY = 'job-signal-xp-awards';
  const XP_BY_STATUS = { New: 0, Applied: 50, OA: 100, 'Phone Screen': 250, Interview: 250, Onsite: 500, Offer: 1000, Rejected: 0, Withdrawn: 0 };
  const LEVELS = [
    { min: 0, title: 'Resume Rookie' },
    { min: 200, title: 'Applicant' },
    { min: 500, title: 'Phone Screen Pro' },
    { min: 1200, title: 'Onsite Warrior' },
    { min: 2500, title: 'Offer Collector' },
  ];
  const getXp = () => Number(localStorage.getItem(XP_KEY) || 0);
  const getXpAwards = () => { try { return JSON.parse(localStorage.getItem(XP_AWARDS_KEY) || '{}'); } catch { return {}; } };
  const awardXpForStatus = (roleId, status) => {
    const target = XP_BY_STATUS[status] || 0;
    const awards = getXpAwards();
    const prev = awards[roleId] || 0;
    if (target > prev) {
      localStorage.setItem(XP_KEY, String(getXp() + (target - prev)));
      awards[roleId] = target;
      localStorage.setItem(XP_AWARDS_KEY, JSON.stringify(awards));
    }
  };
  const levelFor = (xp) => {
    let lvl = LEVELS[0];
    let next = null;
    for (let i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i].min) lvl = LEVELS[i];
      else { next = LEVELS[i]; break; }
    }
    return { lvl, next };
  };

  /* ---------- Streaks: consecutive days with tracker activity ---------- */
  const STREAK_KEY = 'job-signal-streak-days';
  const dayStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const recordStreakDay = () => {
    const today = dayStamp();
    let days;
    try { days = JSON.parse(localStorage.getItem(STREAK_KEY) || '[]'); } catch { days = []; }
    if (!days.includes(today)) {
      days.push(today);
      localStorage.setItem(STREAK_KEY, JSON.stringify(days.slice(-90)));
    }
  };
  const streakCount = () => {
    let days;
    try { days = new Set(JSON.parse(localStorage.getItem(STREAK_KEY) || '[]')); } catch { return 0; }
    const d = new Date();
    if (!days.has(dayStamp(d))) d.setDate(d.getDate() - 1);
    let count = 0;
    while (days.has(dayStamp(d))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  };

  /* ---------- Wild encounters: unseen story drops ---------- */
  const SEEN_DROPS_KEY = 'job-signal-seen-drops';
  const dropKey = (d) => `${d.dateSeen}|${d.company}|${d.title}`;
  const seenDrops = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_DROPS_KEY) || '[]')); } catch { return new Set(); } };

  const JB = {
    esc, normCompany,
    logoManifest: {},
    rarityOf, maxCompValue,
    getXp, awardXpForStatus, levelFor, recordStreakDay, streakCount, dayStamp,
    dropKey, seenDrops, SEEN_DROPS_KEY,
    logoFallback(img) {
      const company = img.getAttribute('data-company') || '';
      const cls = img.getAttribute('data-cls') || 'company-logo';
      const initial = (String(company).trim()[0] || '?').toUpperCase();
      const span = document.createElement('span');
      span.className = `${cls} logo-fallback`;
      span.setAttribute('aria-hidden', 'true');
      span.textContent = initial;
      img.replaceWith(span);
    },
  };
  window.JB = JB;

  /* ================= Components ================= */

  class LogoImg extends HTMLElement {
    static get observedAttributes() { return ['company', 'cls']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const company = this.getAttribute('company') || '';
      const cls = this.getAttribute('cls') || 'company-logo';
      const path = JB.logoManifest[normCompany(company)];
      if (path) {
        this.innerHTML = `<img class="${esc(cls)}" src="${esc(path)}" alt="${esc(company)} logo" loading="lazy" data-company="${esc(company)}" data-cls="${esc(cls)}" onerror="JB.logoFallback(this)">`;
      } else {
        const initial = (String(company).trim()[0] || '?').toUpperCase();
        this.innerHTML = `<span class="${esc(cls)} logo-fallback" aria-hidden="true">${esc(initial)}</span>`;
      }
    }
  }

  class StatusPill extends HTMLElement {
    static get observedAttributes() { return ['kind', 'value']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const kind = this.getAttribute('kind');
      const value = this.getAttribute('value') || '';
      if (kind === 'sudo') {
        const label = { added: 'Added', pending: 'Pending', skipped: 'Skipped' }[value] || 'Pending';
        this.innerHTML = `<span class="pill ${esc(value || 'pending')}">${esc(label)}</span>`;
      } else if (kind === 'priority') {
        const cls = value.toLowerCase().replaceAll(' ', '-');
        this.innerHTML = `<span class="priority ${esc(cls)}">${esc(value)}</span>`;
      } else {
        this.innerHTML = `<span class="pill">${esc(value)}</span>`;
      }
    }
  }

  class RarityBadge extends HTMLElement {
    static get observedAttributes() { return ['company']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const tier = rarityOf(this.getAttribute('company') || '');
      this.innerHTML = `<span class="rarity ${tier}">${RARITY_LABEL[tier]}</span>`;
    }
  }

  class ShinyBadge extends HTMLElement {
    static get observedAttributes() { return ['comp']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      this.innerHTML = maxCompValue(this.getAttribute('comp') || '') >= 200000
        ? '<span class="shiny-badge">Shiny</span>' : '';
    }
  }

  class RoleCard extends HTMLElement {
    static get observedAttributes() {
      return ['company', 'title', 'location', 'emptype', 'category', 'priority', 'posted', 'discovered', 'freshness', 'rationale', 'url', 'role-id'];
    }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const g = (n) => this.getAttribute(n) || '';
      const fresh = g('freshness') ? `<span class="freshness">Source freshness: ${esc(g('freshness'))}</span>` : '';
      this.innerHTML = `<article class="role-card">
        <div class="role-head"><div class="company-line"><logo-img company="${esc(g('company'))}" cls="company-logo"></logo-img><div><p class="eyebrow">${esc(g('emptype'))} · ${esc(g('category'))}</p><h3>${esc(g('title'))}</h3><p class="company">${esc(g('company'))} <span>·</span> ${esc(g('location'))}</p></div></div><div class="head-badges"><rarity-badge company="${esc(g('company'))}"></rarity-badge><shiny-badge comp="${esc(g('rationale'))}"></shiny-badge><status-pill kind="priority" value="${esc(g('priority'))}"></status-pill></div></div>
        <p>${esc(g('rationale'))}</p>
        <div class="meta"><span>Posted: ${esc(g('posted') || 'Not listed')}</span><span>Discovered: ${esc(g('discovered'))}</span>${fresh}</div>
        <a href="${esc(g('url'))}" target="_blank" rel="noreferrer" data-track-role="${esc(g('role-id'))}">Open application</a>
      </article>`;
    }
  }

  class DropEntry extends HTMLElement {
    static get observedAttributes() {
      return ['mode', 'company', 'title', 'location', 'type', 'dateseen', 'comp', 'status', 'skipreason', 'note', 'url', 'wild'];
    }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const g = (n) => this.getAttribute(n) || '';
      if (g('mode') === 'compact') {
        const isNew = g('wild') === '1';
        const wild = isNew ? `<span class="wild-header">A wild ${esc(g('company'))} appeared!</span>` : '';
        this.innerHTML = `<div class="sudo-line${isNew ? ' wild-new' : ''}">${wild}<status-pill kind="sudo" value="${esc(g('status'))}"></status-pill><span>${esc(g('title'))} — ${esc(g('company'))}</span></div>`;
        return;
      }
      const reason = g('skipreason') ? `<p class="skip-reason">Skipped: ${esc(g('skipreason'))}</p>` : '';
      const note = g('note') ? `<p class="drop-note">${esc(g('note'))}</p>` : '';
      const link = g('url')
        ? `<a href="${esc(g('url'))}" target="_blank" rel="noreferrer">Open posting</a>`
        : `<span class="meta no-link">No link captured from story</span>`;
      this.innerHTML = `<article class="role-card drop-card">
        <div class="role-head"><div class="company-line"><logo-img company="${esc(g('company'))}" cls="company-logo"></logo-img><div><p class="eyebrow">${esc(g('type'))} · SEEN ${esc(g('dateseen'))}</p><h3>${esc(g('title'))}</h3><p class="company">${esc(g('company'))} <span>·</span> ${esc(g('location'))}</p></div></div><div class="head-badges"><rarity-badge company="${esc(g('company'))}"></rarity-badge><shiny-badge comp="${esc(g('comp'))}"></shiny-badge><status-pill kind="sudo" value="${esc(g('status'))}"></status-pill></div></div>
        ${g('comp') ? `<div class="meta"><span>Comp: ${esc(g('comp'))}</span></div>` : ''}
        ${reason}${note}
        ${link}
      </article>`;
    }
  }

  class XpHud extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.bound) {
        this.dataset.bound = '1';
        document.addEventListener('jb:hud', () => this.render());
      }
      this.render();
    }
    render() {
      const xp = getXp();
      const { lvl, next } = levelFor(xp);
      const pct = next ? Math.min(100, Math.round(((xp - lvl.min) / (next.min - lvl.min)) * 100)) : 100;
      this.innerHTML = `<div class="hud-row">`
        + `<span class="hud-level">${esc(lvl.title)}</span>`
        + `<div class="xp-bar" role="progressbar" aria-valuenow="${xp}" aria-valuemin="0" aria-label="Experience points"><div class="xp-fill" style="width:${pct}%"></div></div>`
        + `<span class="hud-xp">${xp} XP</span>`
        + `<span class="hud-streak" title="Consecutive active days">🔥 ${streakCount()}</span>`
        + `</div>`
        + (next
          ? `<p class="hud-next">${next.min - xp} XP to ${esc(next.title)}</p>`
          : `<p class="hud-next">Max level reached</p>`);
    }
  }

  class ProcCard extends HTMLElement {
    static get observedAttributes() { return ['company', 'title', 'url', 'status', 'days', 'next']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const g = (n) => this.getAttribute(n) || '';
      const daysRaw = g('days');
      const days = daysRaw === '' ? null : Number(daysRaw);
      const stale = days !== null && days >= 7;
      const daysText = days === null ? 'date unknown' : (days === 0 ? 'today' : `${days}d ago`);
      this.innerHTML = `<article class="role-card proc-card${stale ? ' stale' : ''}">
        <div class="role-head"><div class="company-line"><logo-img company="${esc(g('company'))}" cls="company-logo"></logo-img><div><p class="eyebrow">${esc(g('status'))}</p><h3>${esc(g('title'))}</h3><p class="company">${esc(g('company'))}</p></div></div><div class="head-badges"><rarity-badge company="${esc(g('company'))}"></rarity-badge></div></div>
        <p class="proc-next">Next: ${esc(g('next'))}</p>
        <div class="meta"><span>Last change: ${esc(daysText)}</span>${stale ? '<span class="stale-flag">Stale 7+ days</span>' : ''}</div>
        <a href="${esc(g('url'))}" target="_blank" rel="noreferrer">Open posting</a>
      </article>`;
    }
  }

  customElements.define('logo-img', LogoImg);
  customElements.define('status-pill', StatusPill);
  customElements.define('rarity-badge', RarityBadge);
  customElements.define('shiny-badge', ShinyBadge);
  customElements.define('role-card', RoleCard);
  customElements.define('drop-entry', DropEntry);
  customElements.define('xp-hud', XpHud);
  customElements.define('proc-card', ProcCard);

  document.addEventListener('jb:logos', () => {
    document.querySelectorAll('logo-img').forEach((el) => el.render());
  });
})();
