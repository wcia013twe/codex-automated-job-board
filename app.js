/* Job Signal Board — app logic. Rendering is done by the reusable Web
   Components in components.js (window.JB). Presentation only: data files
   and all collected descriptions/analysis are never modified here.
   All client state goes through the centralized store (JB.store); no
   direct localStorage access remains in this file. */
const escapeHtml = JB.esc;

const fullTimeGrid = document.querySelector('#full-time-grid');
const internshipGrid = document.querySelector('#internship-grid');
const tracker = document.querySelector('#tracker');
const trackerCounts = document.querySelector('#tracker-counts');
const summary = document.querySelector('#summary');
const search = document.querySelector('#search');
const typeFilter = document.querySelector('#type-filter');
let roles = [];
let currentRunDate = '';
const store = () => JB.store;
const trackedIds = () => new Set(store().get('tracker.ids') || []);
const saveTrackedIds = (ids) => store().set('tracker.ids', [...ids]);
const trackerItem = (id) => (store().get('tracker.items') || {})[id] || {};
const appliedDate = (id) => trackerItem(id).appliedDate || 'Not applied';

const TRACKER_STATUSES = ['New', 'Applied', 'OA', 'Phone Screen', 'Interview', 'Onsite', 'Offer', 'Rejected', 'Withdrawn'];

function roleCardEl(role) {
  const el = document.createElement('role-card');
  el.setAttribute('company', role.company || '');
  el.setAttribute('title', role.title || '');
  el.setAttribute('location', role.location || '');
  el.setAttribute('emptype', role.employmentType || '');
  el.setAttribute('category', role.category || '');
  el.setAttribute('priority', role.priority || '');
  el.setAttribute('posted', role.postedDate || 'Not listed');
  el.setAttribute('discovered', role.discoveredDate || '');
  el.setAttribute('freshness', role.sourceFreshness || '');
  el.setAttribute('rationale', role.whyItFits || '');
  el.setAttribute('url', role.applicationUrl || '');
  el.setAttribute('role-id', role.id || '');
  return el;
}

function trackerRow(role) {
  const status = role.applicationStatus;
  const opts = TRACKER_STATUSES.map((s) => `<option${s === status ? ' selected' : ''}>${s}</option>`).join('');
  return `<div class="tracker-row" role="row">
    <strong>${escapeHtml(role.company)}</strong>
    <a href="${escapeHtml(role.applicationUrl)}" target="_blank" rel="noreferrer">${escapeHtml(role.title)}</a>
    <span>${escapeHtml(role.employmentType)}</span>
    <span>${appliedDate(role.id)}</span>
    <select aria-label="Status for ${escapeHtml(role.title)}" data-id="${escapeHtml(role.id)}">${opts}</select>
  </div>`;
}

function setGrid(grid, items, emptyMsg, makeEl) {
  grid.innerHTML = '';
  if (!items.length) {
    grid.innerHTML = `<p class="empty">${emptyMsg}</p>`;
    return;
  }
  items.forEach((item) => grid.appendChild(makeEl(item)));
}

function render() {
  const needle = search.value.toLowerCase();
  const type = typeFilter.value;
  const matches = (role) => (!type || role.employmentType === type) && `${role.company} ${role.title} ${role.category} ${role.location}`.toLowerCase().includes(needle);
  const tracked = trackedIds();
  const dailyRoles = roles.filter((role) => matches(role) && role.discoveredDate === currentRunDate && !tracked.has(role.id));
  const trackedRoles = roles.filter((role) => matches(role) && tracked.has(role.id));
  const fullTimeRoles = dailyRoles.filter((role) => role.employmentType === 'FT');
  const internshipRoles = dailyRoles.filter((role) => role.employmentType === 'Internship');
  const applyNow = dailyRoles.filter((role) => role.priority === 'Apply Now').length;
  summary.textContent = `${dailyRoles.length} to review · ${applyNow} apply now`;
  setGrid(fullTimeGrid, fullTimeRoles, 'No new full-time roles in this run.', roleCardEl);
  setGrid(internshipGrid, internshipRoles, 'No internships cleared the specialization bar in this run.', roleCardEl);
  tracker.innerHTML = trackedRoles.map(trackerRow).join('') || '<p class="empty tracker-empty">Open an application from Daily Board to start tracking it here.</p>';
  const trackedFT = trackedRoles.filter((role) => role.employmentType === 'FT').length;
  const trackedInternships = trackedRoles.filter((role) => role.employmentType === 'Internship').length;
  trackerCounts.innerHTML = `<span><strong>${trackedFT}</strong> full-time</span><span><strong>${trackedInternships}</strong> internships</span>`;
  renderProcs();
}

document.querySelectorAll('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('[role="tab"]').forEach((item) => item.setAttribute('aria-selected', item === tab));
  document.querySelectorAll('[role="tabpanel"]').forEach((panel) => panel.hidden = panel.id !== tab.getAttribute('aria-controls'));
}));
search.addEventListener('input', render);
typeFilter.addEventListener('change', render);
tracker.addEventListener('change', (event) => {
  if (!event.target.matches('select[data-id]')) return;
  const role = roles.find((item) => item.id === event.target.dataset.id);
  if (!role) return;
  role.applicationStatus = event.target.value;
  store().update('tracker.items', (items) => {
    const cur = items[role.id] || {};
    items[role.id] = { ...cur, status: event.target.value, statusDate: JB.dayStamp() };
    return items;
  });
  JB.awardXpForStatus(role.id, event.target.value);
  JB.recordStreakDay();
  renderProcs();
});
document.querySelector('#daily-board').addEventListener('click', (event) => {
  const link = event.target.closest('[data-track-role]');
  if (!link) return;
  const tracked = trackedIds();
  tracked.add(link.dataset.trackRole);
  saveTrackedIds(tracked);
  store().update('tracker.items', (items) => {
    const cur = items[link.dataset.trackRole] || {};
    items[link.dataset.trackRole] = { ...cur, appliedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) };
    return items;
  });
  JB.recordStreakDay();
  window.setTimeout(render, 0);
});

Promise.all([
  fetch('./data/jobs.json').then((response) => response.json()),
  fetch('./data/sudo-drops.json').then((response) => response.json()).catch(() => ({ drops: [] })),
  fetch('./data/logo-manifest.json').then((response) => response.json()).catch(() => ({})),
]).then(([jobsData, dropsData, manifest]) => {
  // Mutate the shared object in place: components.js captured the original
  // logoManifest reference when it ran Object.assign(window.JB, JB), so
  // replacing it here would leave LogoImg.render() reading a stale empty
  // object and no logos would ever render.
  Object.assign(JB.logoManifest, manifest || {});
  document.dispatchEvent(new Event('jb:logos'));
  roles = jobsData.roles.map((role) => ({ ...role, applicationStatus: trackerItem(role.id).status || role.applicationStatus }));
  currentRunDate = jobsData.lastRun;
  document.querySelector('#updated').textContent = `Last scan: ${jobsData.lastRun}`;
  render();
  renderSudo(dropsData.drops || []);
  maybeShowPack();
});

/* ---- Procs tab: interview pipeline from the same tracker data (no new entry, no schema changes) ---- */
const PROC_STAGES = ['Applied', 'OA', 'Phone Screen', 'Interview', 'Onsite', 'Offer'];
const CLOSED_STATUSES = new Set(['Rejected', 'Withdrawn']);
const NEXT_ACTION = {
  New: 'Submit the application',
  Applied: 'Follow up in about a week; keep prepping for the OA',
  OA: 'Finish the online assessment',
  'Phone Screen': 'Prep for the technical screen',
  Interview: 'Prep for the technical rounds',
  Onsite: 'Send thank-yous; wait for the decision',
  Offer: 'Negotiate and decide',
};
const stageOf = (status) => (status === 'New' ? 'Applied' : status);
const statusDateOf = (id) => trackerItem(id).statusDate || trackerItem(id).appliedDate || null;
function daysSince(str) {
  if (!str) return null;
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(str);
  }
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now - d) / 86400000));
}

function procCardEl(item) {
  const el = document.createElement('proc-card');
  const r = item.role;
  el.setAttribute('company', r.company || '');
  el.setAttribute('title', r.title || '');
  el.setAttribute('url', r.applicationUrl || '');
  el.setAttribute('status', item.status);
  el.setAttribute('days', item.days === null ? '' : String(item.days));
  el.setAttribute('next', NEXT_ACTION[item.status] || 'Keep it moving');
  return el;
}

function renderProcs() {
  const pipeline = document.querySelector('#proc-pipeline');
  const closedWrap = document.querySelector('#proc-closed');
  const closedCount = document.querySelector('#proc-closed-count');
  if (!pipeline || !closedWrap || !closedCount) return;
  const tracked = trackedIds();
  const items = roles
    .filter((r) => tracked.has(r.id))
    .map((r) => ({ role: r, status: r.applicationStatus || 'New', days: daysSince(statusDateOf(r.id)) }));
  const active = items
    .filter((i) => !CLOSED_STATUSES.has(i.status))
    .sort((a, b) => (b.days === null ? -1 : b.days) - (a.days === null ? -1 : a.days));
  const closed = items.filter((i) => CLOSED_STATUSES.has(i.status));
  pipeline.innerHTML = '';
  PROC_STAGES.forEach((stage) => {
    const col = document.createElement('section');
    col.className = 'proc-col';
    const cards = active.filter((i) => stageOf(i.status) === stage);
    const h = document.createElement('h3');
    h.innerHTML = `${escapeHtml(stage)} <span class="proc-count">${cards.length}</span>`;
    const wrap = document.createElement('div');
    wrap.className = 'proc-col-cards';
    if (cards.length) cards.forEach((i) => wrap.appendChild(procCardEl(i)));
    else wrap.innerHTML = '<p class="empty">—</p>';
    col.appendChild(h);
    col.appendChild(wrap);
    pipeline.appendChild(col);
  });
  closedCount.textContent = String(closed.length);
  closedWrap.innerHTML = '';
  if (closed.length) closed.forEach((i) => closedWrap.appendChild(procCardEl(i)));
  else closedWrap.innerHTML = '<p class="empty">Nothing closed yet.</p>';
}

/* ---- Referrals tab: referral tracker, networking, templates (store-backed, browser-only) ---- */
const referralList = document.querySelector('#referral-list');
const networkList = document.querySelector('#network-list');
const templatesGrid = document.querySelector('#templates');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Referral/networking data lives in the store (network slice); renders below
// subscribe to it so mutations re-render automatically.
const loadReferrals = () => store().get('network.referrals') || [];
const saveReferrals = (val) => store().set('network.referrals', val);
const loadPeople = () => store().get('network.people') || [];
const savePeople = (val) => store().set('network.people', val);
const REF_STATUSES = ['Not asked', 'Asked', 'Referred', 'Applied', 'Interviewing', 'Offer', 'Rejected'];

const TEMPLATES = [
  { name: 'Engineer you know', use: 'Someone on the team you have talked to before.', body: `Hey [Name], saw you're on [Team] at [Company]. I'm applying for the [Title] role and your work on [specific thing] stood out. I did backend work at Goldman last summer and have an Oracle offer, but I'm looking for something more infra focused. Open to referring me? I can send my resume and the link. Thanks either way.` },
  { name: 'Engineer (cold)', use: 'No prior contact, but the team is a strong fit.', body: `Hi [Name], I'm Wesley, new grad SWE. I found you while looking into [Team] at [Company]. I've been working on [relevant project or stack] and the [Title] post looks like a fit. Would you be open to a quick chat or a referral? Totally fine if not. I can send over details.` },
  { name: 'Recruiter', use: 'Recruiter for the role, keep it short and direct.', body: `Hi [Name], I'm interested in the [Title] role at [Company] in [Location]. I'm a recent grad with SWE experience at Goldman and an Oracle offer, mostly backend and distributed systems. Is the team still hiring for this? Happy to send my resume and a short summary. Thanks, Wesley` },
  { name: 'Alum', use: 'Shared school, weak tie.', body: `Hey [Name], fellow [School] grad here. I'm applying for [Title] at [Company] and saw you joined [Team] last year. Most of my work has been backend at Goldman and Oracle. Would you be comfortable with a referral? I'll make it easy on my end.` },
  { name: 'Former coworker', use: 'Worked together before, shared context.', body: `Hey [Name], we worked together on [project or team] at [Company]. I'm applying for [Title] at [NewCompany] and it lines up with the backend work we did. Would you be open to referring me? I can send my resume and the posting. Appreciate it.` },
  { name: 'Friend', use: 'Low pressure ask.', body: `Hey [Name], quick favor. I'm applying for [Title] at [Company]. Any chance you could refer me? Happy to send everything you need. No pressure at all.` },
  { name: 'Networking first touch', use: 'No ask yet, just start the conversation.', body: `Hi [Name], I'm Wesley, new grad SWE focused on backend and distributed systems. I saw your team at [Company] is working on [thing]. Would you be open to a 15 min chat about the work? Trying to learn more about the space.` },
  { name: 'After a chat: referral ask', use: 'Follow up once they know you.', body: `Hi [Name], thanks for the chat, the part about [detail] was really helpful. I'm applying for the [Title] role on your team. Would you be comfortable referring me? I can send my resume and the link.` },
  { name: 'Thank you', use: 'Send within a day of the referral.', body: `Hi [Name], just wanted to say thanks for the referral for [Title] at [Company]. Really appreciate you putting your name behind me. I'll keep you posted on how it goes.` },
  { name: 'Bump', use: 'One nudge after 5 to 7 days, same thread.', body: `Hi [Name], bumping this in case it got buried. Still interested in the [Title] role at [Company] if you're open to referring me. Happy to send my resume and link. Thanks!` },
];

function renderTemplates() {
  if (!templatesGrid) return;
  templatesGrid.innerHTML = TEMPLATES.map((t, i) => `<article class="role-card template-card">
    <div class="role-head"><div><p class="eyebrow">${escapeHtml(t.use)}</p><h3>${escapeHtml(t.name)}</h3></div></div>
    <p class="template-body">${escapeHtml(t.body)}</p>
    <button class="copy-btn" data-template="${i}">Copy message</button>
  </article>`).join('');
}

function renderReferrals() {
  if (!referralList) return;
  const items = loadReferrals();
  referralList.innerHTML = items.map((r) => `<div class="tracker-row ref-row" role="row">
    <strong>${escapeHtml(r.company)}</strong>
    ${r.link ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noreferrer">${escapeHtml(r.title)}</a>` : `<span>${escapeHtml(r.title)}</span>`}
    <span>${escapeHtml(r.contact)}</span>
    <span>${escapeHtml(r.path)}</span>
    <select aria-label="Referral status" data-ref-id="${escapeHtml(r.id)}">${REF_STATUSES.map((s) => `<option${s === r.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
    <button class="icon-btn" data-del-ref="${escapeHtml(r.id)}" aria-label="Remove">x</button>
  </div>`).join('') || '<p class="empty tracker-empty">Add your first referral target above.</p>';
}

function renderNetwork() {
  if (!networkList) return;
  const items = loadPeople();
  networkList.innerHTML = items.map((n) => `<div class="tracker-row net-row" role="row">
    <strong>${escapeHtml(n.name)}</strong>
    <span>${escapeHtml(n.company)}</span>
    <span class="warmth ${escapeHtml(n.warmth.toLowerCase())}">${escapeHtml(n.warmth)}</span>
    <span>${escapeHtml(n.followUp || 'No date set')}${n.notes ? ` - ${escapeHtml(n.notes)}` : ''}</span>
    <button class="icon-btn" data-del-net="${escapeHtml(n.id)}" aria-label="Remove">x</button>
  </div>`).join('') || '<p class="empty tracker-empty">Add people you want to stay in touch with.</p>';
}

const referralForm = document.querySelector('#referral-form');
if (referralForm) referralForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const items = loadReferrals();
  items.unshift({
    id: uid(),
    company: document.querySelector('#ref-company').value.trim(),
    title: document.querySelector('#ref-title').value.trim(),
    contact: document.querySelector('#ref-contact').value.trim(),
    path: document.querySelector('#ref-path').value,
    link: document.querySelector('#ref-link').value.trim(),
    status: 'Not asked',
  });
  saveReferrals(items); // store subscription re-renders the list
  referralForm.reset();
});

const networkForm = document.querySelector('#network-form');
if (networkForm) networkForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const items = loadPeople();
  items.unshift({
    id: uid(),
    name: document.querySelector('#net-name').value.trim(),
    company: document.querySelector('#net-company').value.trim(),
    warmth: document.querySelector('#net-warmth').value,
    followUp: document.querySelector('#net-followup').value,
    notes: document.querySelector('#net-notes').value.trim(),
  });
  savePeople(items); // store subscription re-renders the list
  networkForm.reset();
});

document.querySelector('#referrals').addEventListener('change', (e) => {
  if (!e.target.matches('select[data-ref-id]')) return;
  const items = loadReferrals();
  const item = items.find((r) => r.id === e.target.dataset.refId);
  if (item) { item.status = e.target.value; saveReferrals(items); }
});

document.querySelector('#referrals').addEventListener('click', (e) => {
  const delRef = e.target.closest('[data-del-ref]');
  if (delRef) {
    saveReferrals(loadReferrals().filter((r) => r.id !== delRef.dataset.delRef));
    return;
  }
  const delNet = e.target.closest('[data-del-net]');
  if (delNet) {
    savePeople(loadPeople().filter((n) => n.id !== delNet.dataset.delNet));
    return;
  }
  const copyBtn = e.target.closest('[data-template]');
  if (copyBtn) {
    const t = TEMPLATES[Number(copyBtn.dataset.template)];
    const done = () => { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy message'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t.body).then(done).catch(done);
    } else {
      const ta = document.createElement('textarea');
      ta.value = t.body;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      done();
    }
  }
});

renderTemplates();
renderReferrals();
renderNetwork();
// Mutations above write through the store; subscriptions re-render automatically.
store().subscribe('network.referrals', renderReferrals);
store().subscribe('network.people', renderNetwork);

/* ---- Story Drops: expandable block on the Daily Board, reads data/sudo-drops.json ---- */
const formatSudoDate = (iso) => {
  const parts = String(iso).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

let sudoDrops = [];
let todaysPackDrops = [];
function markDropsSeen() {
  sudoDrops.forEach((d) => JB.markDropSeen(JB.dropKey(d)));
}

/* ---- Pack opening: daily drop pack with tap-to-upgrade cards ---- */
const REC_RANK = { 'Apply Now': 3, 'Strong Consider': 2, 'Skip Unless Team Fit': 1 };
const normTitle = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function recommendationOf(drop) {
  const nc = JB.normCompany(drop.company || '');
  const nt = normTitle(drop.title);
  const hit = roles.find((r) => JB.normCompany(r.company || '') === nc && normTitle(r.title) === nt);
  return hit ? hit.priority : null;
}
function buildPackItems(drops) {
  const byCompany = {};
  drops.forEach((d) => {
    const k = JB.normCompany(d.company || '');
    (byCompany[k] = byCompany[k] || []).push(d);
  });
  const items = [];
  Object.values(byCompany).forEach((group) => {
    const ft = group.find((d) => (d.type || '') === 'FT');
    const intern = group.find((d) => (d.type || '') === 'Internship');
    if (ft && intern) {
      const rFt = REC_RANK[recommendationOf(ft)] || 0;
      const rIn = REC_RANK[recommendationOf(intern)] || 0;
      const ftStronger = rFt >= rIn; // tie or neither on board: full-time glows by default
      items.push({
        kind: 'double',
        drops: [
          { ...ft, glow: ftStronger ? 'strong' : 'weak' },
          { ...intern, glow: ftStronger ? 'weak' : 'strong' },
        ],
      });
      group.filter((d) => d !== ft && d !== intern).forEach((d) => items.push({ kind: 'single', drop: d }));
    } else {
      group.forEach((d) => items.push({ kind: 'single', drop: d }));
    }
  });
  return items;
}
function showPack(drops) {
  document.querySelectorAll('pack-opening').forEach((el) => el.remove());
  const el = document.createElement('pack-opening');
  el.items = buildPackItems(drops);
  document.body.appendChild(el);
}
function maybeShowPack() {
  todaysPackDrops = sudoDrops.filter((d) => d.dateSeen === JB.dayStamp());
  const replay = document.querySelector('#pack-replay');
  if (replay) replay.hidden = !todaysPackDrops.length;
  const stamped = store().get(`drops.packStamps.${JB.dayStamp()}`);
  if (todaysPackDrops.length && !stamped) showPack(todaysPackDrops);
}
document.addEventListener('pack:closed', () => {
  markDropsSeen();
  renderSudo(sudoDrops);
});
const packReplay = document.querySelector('#pack-replay');
if (packReplay) packReplay.addEventListener('click', () => {
  if (todaysPackDrops.length) showPack(todaysPackDrops);
});

function dropEntryEl(drop, mode, isNew) {
  const el = document.createElement('drop-entry');
  el.setAttribute('mode', mode);
  el.setAttribute('company', drop.company || '');
  el.setAttribute('title', drop.title || '');
  el.setAttribute('location', drop.location || '');
  el.setAttribute('type', drop.type || '');
  el.setAttribute('dateseen', drop.dateSeen || '');
  el.setAttribute('comp', drop.comp || '');
  el.setAttribute('status', drop.status || 'pending');
  el.setAttribute('skipreason', drop.skipReason || '');
  el.setAttribute('note', drop.note || '');
  el.setAttribute('url', drop.url || '');
  el.setAttribute('wild', isNew ? '1' : '0');
  return el;
}

function dropRowEl(drop) {
  const el = document.createElement('drop-row');
  el.setAttribute('company', drop.company || '');
  el.setAttribute('title', drop.title || '');
  el.setAttribute('location', drop.location || '');
  el.setAttribute('type', drop.type || '');
  el.setAttribute('dateseen', drop.dateSeen || '');
  el.setAttribute('comp', drop.comp || '');
  el.setAttribute('status', drop.status || 'pending');
  el.setAttribute('skipreason', drop.skipReason || '');
  el.setAttribute('note', drop.note || '');
  el.setAttribute('url', drop.url || '');
  return el;
}

function renderSudo(drops) {
  const block = document.querySelector('#sudo-block');
  if (!block) return;
  sudoDrops = drops;
  if (!block.dataset.wildBound) {
    block.dataset.wildBound = '1';
    block.addEventListener('toggle', () => {
      if (block.open) { markDropsSeen(); renderSudo(sudoDrops); }
    });
  }
  const seen = JB.seenDrops();
  const collapsed = document.querySelector('#sudo-collapsed');
  const full = document.querySelector('#sudo-full');
  collapsed.innerHTML = '';
  full.innerHTML = '';
  if (!drops.length) {
    collapsed.innerHTML = '<p class="empty">No story drops logged yet.</p>';
    return;
  }
  const byDate = {};
  drops.forEach((d) => { (byDate[d.dateSeen] = byDate[d.dateSeen] || []).push(d); });
  const dates = Object.keys(byDate).sort().reverse();
  dates.forEach((dt) => {
    const items = byDate[dt];
    const added = items.filter((d) => d.status === 'added').length;
    const group = document.createElement('div');
    group.className = 'sudo-date-group';
    const summaryP = document.createElement('p');
    summaryP.className = 'sudo-date-summary';
    summaryP.innerHTML = `<strong>${escapeHtml(formatSudoDate(dt))}</strong>: ${items.length} drops, ${added} added to board`;
    const compact = document.createElement('div');
    compact.className = 'sudo-compact';
    items.forEach((d) => compact.appendChild(dropEntryEl(d, 'compact', !seen.has(JB.dropKey(d)))));
    group.appendChild(summaryP);
    group.appendChild(compact);
    collapsed.appendChild(group);

    const fullGroup = document.createElement('div');
    fullGroup.className = 'sudo-date-group';
    const fullP = document.createElement('p');
    fullP.className = 'sudo-date-summary';
    fullP.innerHTML = `<strong>${escapeHtml(formatSudoDate(dt))}</strong> — tap a row for details`;
    const list = document.createElement('div');
    list.className = 'sudo-dense';
    const addedItems = items.filter((d) => d.status === 'added');
    const pendingItems = items.filter((d) => d.status === 'pending');
    const skippedItems = items.filter((d) => d.status === 'skipped');
    addedItems.forEach((d) => list.appendChild(dropRowEl(d)));
    pendingItems.forEach((d) => list.appendChild(dropRowEl(d)));
    fullGroup.appendChild(fullP);
    fullGroup.appendChild(list);
    if (skippedItems.length) {
      const det = document.createElement('details');
      det.className = 'sudo-skipped';
      const sum = document.createElement('summary');
      const word = skippedItems.length === 1 ? 'role' : 'roles';
      sum.innerHTML = `<span>${skippedItems.length} skipped ${word}</span><span class="sudo-skipped-hint">show</span>`;
      const skList = document.createElement('div');
      skList.className = 'sudo-dense';
      skippedItems.forEach((d) => skList.appendChild(dropRowEl(d)));
      det.appendChild(sum);
      det.appendChild(skList);
      fullGroup.appendChild(det);
    }
    full.appendChild(fullGroup);
  });
}
