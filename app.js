/* Job Signal Board — app logic. Rendering is done by the reusable Web
   Components in components.js (window.JB). Presentation only: data files
   and all collected descriptions/analysis are never modified here. */
const escapeHtml = JB.esc;
const refreshHud = () => document.dispatchEvent(new Event('jb:hud'));

const fullTimeGrid = document.querySelector('#full-time-grid');
const internshipGrid = document.querySelector('#internship-grid');
const tracker = document.querySelector('#tracker');
const trackerCounts = document.querySelector('#tracker-counts');
const summary = document.querySelector('#summary');
const search = document.querySelector('#search');
const typeFilter = document.querySelector('#type-filter');
let roles = [];
let currentRunDate = '';
const trackerKey = 'job-signal-tracker-ids';
const trackedIds = () => new Set(JSON.parse(localStorage.getItem(trackerKey) || '[]'));
const saveTrackedIds = (ids) => localStorage.setItem(trackerKey, JSON.stringify([...ids]));
const appliedDate = (id) => localStorage.getItem(`applied-date:${id}`) || 'Not applied';

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
  refreshHud();
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
  localStorage.setItem(`status:${role.id}`, role.applicationStatus);
  localStorage.setItem(`status-date:${role.id}`, JB.dayStamp());
  JB.awardXpForStatus(role.id, event.target.value);
  JB.recordStreakDay();
  renderProcs();
  refreshHud();
});
document.querySelector('#daily-board').addEventListener('click', (event) => {
  const link = event.target.closest('[data-track-role]');
  if (!link) return;
  const tracked = trackedIds();
  tracked.add(link.dataset.trackRole);
  saveTrackedIds(tracked);
  localStorage.setItem(`applied-date:${link.dataset.trackRole}`, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
  JB.recordStreakDay();
  window.setTimeout(render, 0);
});

Promise.all([
  fetch('./data/jobs.json').then((response) => response.json()),
  fetch('./data/sudo-drops.json').then((response) => response.json()).catch(() => ({ drops: [] })),
  fetch('./data/logo-manifest.json').then((response) => response.json()).catch(() => ({})),
]).then(([jobsData, dropsData, manifest]) => {
  JB.logoManifest = manifest || {};
  document.dispatchEvent(new Event('jb:logos'));
  roles = jobsData.roles.map((role) => ({ ...role, applicationStatus: localStorage.getItem(`status:${role.id}`) || role.applicationStatus }));
  currentRunDate = jobsData.lastRun;
  document.querySelector('#updated').textContent = `Last scan: ${jobsData.lastRun}`;
  render();
  renderSudo(dropsData.drops || []);
  refreshHud();
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
const statusDateOf = (id) => localStorage.getItem(`status-date:${id}`) || localStorage.getItem(`applied-date:${id}`) || null;
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

/* ---- Referrals tab: referral tracker, networking, templates (localStorage only) ---- */
const referralList = document.querySelector('#referral-list');
const networkList = document.querySelector('#network-list');
const templatesGrid = document.querySelector('#templates');
const REF_KEY = 'job-signal-referrals';
const NET_KEY = 'job-signal-network';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const loadJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const saveJson = (key, val) => localStorage.setItem(key, JSON.stringify(val));
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
  const items = loadJson(REF_KEY);
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
  const items = loadJson(NET_KEY);
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
  const items = loadJson(REF_KEY);
  items.unshift({
    id: uid(),
    company: document.querySelector('#ref-company').value.trim(),
    title: document.querySelector('#ref-title').value.trim(),
    contact: document.querySelector('#ref-contact').value.trim(),
    path: document.querySelector('#ref-path').value,
    link: document.querySelector('#ref-link').value.trim(),
    status: 'Not asked',
  });
  saveJson(REF_KEY, items);
  referralForm.reset();
  renderReferrals();
});

const networkForm = document.querySelector('#network-form');
if (networkForm) networkForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const items = loadJson(NET_KEY);
  items.unshift({
    id: uid(),
    name: document.querySelector('#net-name').value.trim(),
    company: document.querySelector('#net-company').value.trim(),
    warmth: document.querySelector('#net-warmth').value,
    followUp: document.querySelector('#net-followup').value,
    notes: document.querySelector('#net-notes').value.trim(),
  });
  saveJson(NET_KEY, items);
  networkForm.reset();
  renderNetwork();
});

document.querySelector('#referrals').addEventListener('change', (e) => {
  if (!e.target.matches('select[data-ref-id]')) return;
  const items = loadJson(REF_KEY);
  const item = items.find((r) => r.id === e.target.dataset.refId);
  if (item) { item.status = e.target.value; saveJson(REF_KEY, items); }
});

document.querySelector('#referrals').addEventListener('click', (e) => {
  const delRef = e.target.closest('[data-del-ref]');
  if (delRef) {
    saveJson(REF_KEY, loadJson(REF_KEY).filter((r) => r.id !== delRef.dataset.delRef));
    renderReferrals();
    return;
  }
  const delNet = e.target.closest('[data-del-net]');
  if (delNet) {
    saveJson(NET_KEY, loadJson(NET_KEY).filter((n) => n.id !== delNet.dataset.delNet));
    renderNetwork();
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

/* ---- Story Drops: expandable block on the Daily Board, reads data/sudo-drops.json ---- */
const formatSudoDate = (iso) => {
  const parts = String(iso).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

let sudoDrops = [];
function markDropsSeen() {
  const seen = JB.seenDrops();
  sudoDrops.forEach((d) => seen.add(JB.dropKey(d)));
  localStorage.setItem(JB.SEEN_DROPS_KEY, JSON.stringify([...seen]));
}

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
    fullP.innerHTML = `<strong>${escapeHtml(formatSudoDate(dt))}</strong> — full details`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    items.forEach((d) => grid.appendChild(dropEntryEl(d, 'full', false)));
    fullGroup.appendChild(fullP);
    fullGroup.appendChild(grid);
    full.appendChild(fullGroup);
  });
}
