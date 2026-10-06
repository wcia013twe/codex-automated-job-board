const board = document.querySelector('#board');
const tracker = document.querySelector('#tracker');
const summary = document.querySelector('#summary');
const search = document.querySelector('#search');
const typeFilter = document.querySelector('#type-filter');
let roles = [];
const companyDomains = {
  'DoorDash': 'doordash.com',
  'Render': 'render.com',
  'Kled AI': 'kled.ai',
  'Zettabyte': 'zettabyte.com',
  'Cohere': 'cohere.com',
  'DatologyAI': 'datologyai.com',
  'Lambda': 'lambda.ai',
  'Pulse': 'pulse.com'
};
const trackerKey = 'job-signal-tracker-ids';
const trackedIds = () => new Set(JSON.parse(localStorage.getItem(trackerKey) || '[]'));
const saveTrackedIds = (ids) => localStorage.setItem(trackerKey, JSON.stringify([...ids]));

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const date = (value) => value || 'Not listed';
const freshness = (role) => role.sourceFreshness ? `<span class="freshness">Source freshness: ${escapeHtml(role.sourceFreshness)}</span>` : '';

function roleCard(role, detailed = false) {
  const domain = companyDomains[role.company] || role.applicationUrl;
  const logo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  return `<article class="role-card">
    <div class="role-head"><div class="company-line"><img class="company-logo" src="${logo}" alt="${escapeHtml(role.company)} logo" loading="lazy"><div><p class="eyebrow">${escapeHtml(role.employmentType)} · ${escapeHtml(role.category)}</p><h3>${escapeHtml(role.title)}</h3><p class="company">${escapeHtml(role.company)} <span>·</span> ${escapeHtml(role.location)}</p></div></div><span class="priority ${role.priority.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(role.priority)}</span></div>
    <p>${escapeHtml(role.whyItFits)}</p>
    <div class="meta"><span>Posted: ${date(role.postedDate)}</span><span>Discovered: ${role.discoveredDate}</span>${freshness(role)}</div>
    ${detailed ? `<div class="status-row"><label>Status <select aria-label="Status for ${escapeHtml(role.title)}" data-id="${escapeHtml(role.id)}"><option ${role.applicationStatus === 'New' ? 'selected' : ''}>New</option><option ${role.applicationStatus === 'Applied' ? 'selected' : ''}>Applied</option><option ${role.applicationStatus === 'OA' ? 'selected' : ''}>OA</option><option ${role.applicationStatus === 'Interview' ? 'selected' : ''}>Interview</option><option ${role.applicationStatus === 'Rejected' ? 'selected' : ''}>Rejected</option><option ${role.applicationStatus === 'Offer' ? 'selected' : ''}>Offer</option></select></label></div>` : ''}
    <a href="${escapeHtml(role.applicationUrl)}" target="_blank" rel="noreferrer" data-track-role="${escapeHtml(role.id)}">Open application</a>
  </article>`;
}

function render() {
  const needle = search.value.toLowerCase();
  const type = typeFilter.value;
  const matches = (role) => (!type || role.employmentType === type) && `${role.company} ${role.title} ${role.category} ${role.location}`.toLowerCase().includes(needle);
  const tracked = trackedIds();
  const dailyRoles = roles.filter((role) => matches(role) && !tracked.has(role.id));
  const trackedRoles = roles.filter((role) => matches(role) && tracked.has(role.id));
  const applyNow = dailyRoles.filter((role) => role.priority === 'Apply Now').length;
  summary.textContent = `${dailyRoles.length} to review · ${applyNow} apply now`;
  board.innerHTML = dailyRoles.map((role) => roleCard(role)).join('') || '<p class="empty">Your Daily Board is clear.</p>';
  tracker.innerHTML = trackedRoles.map((role) => roleCard(role, true)).join('') || '<p class="empty">Open an application from Daily Board to start tracking it here.</p>';
}

document.querySelectorAll('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('[role="tab"]').forEach((item) => item.setAttribute('aria-selected', item === tab));
  document.querySelectorAll('[role="tabpanel"]').forEach((panel) => panel.hidden = panel.id !== tab.getAttribute('aria-controls'));
}));
search.addEventListener('input', render);
typeFilter.addEventListener('change', render);
tracker.addEventListener('change', (event) => {
  if (event.target.matches('select[data-id]')) {
    const role = roles.find((item) => item.id === event.target.dataset.id);
    role.applicationStatus = event.target.value;
    localStorage.setItem(`status:${role.id}`, role.applicationStatus);
  }
});
board.addEventListener('click', (event) => {
  const link = event.target.closest('[data-track-role]');
  if (!link) return;
  const tracked = trackedIds();
  tracked.add(link.dataset.trackRole);
  saveTrackedIds(tracked);
  window.setTimeout(render, 0);
});

fetch('./data/jobs.json').then((response) => response.json()).then((data) => {
  roles = data.roles.map((role) => ({ ...role, applicationStatus: localStorage.getItem(`status:${role.id}`) || role.applicationStatus }));
  document.querySelector('#updated').textContent = `Last scan: ${data.lastRun}`;
  render();
});
