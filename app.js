const fullTimeGrid = document.querySelector('#full-time-grid');
const internshipGrid = document.querySelector('#internship-grid');
const tracker = document.querySelector('#tracker');
const trackerCounts = document.querySelector('#tracker-counts');
const summary = document.querySelector('#summary');
const search = document.querySelector('#search');
const typeFilter = document.querySelector('#type-filter');
let roles = [];
let currentRunDate = '';
const companyDomains = {
  'DoorDash': 'doordash.com', 'Render': 'render.com', 'Kled AI': 'kled.ai',
  'Zettabyte': 'zettabyte.com', 'Cohere': 'cohere.com', 'DatologyAI': 'datologyai.com',
  'Lambda': 'lambda.ai', 'Pulse': 'pulse.com', 'Together AI': 'together.ai',
  'SingleStore': 'singlestore.com', 'Freeform': 'freeform.co'
};
const trackerKey = 'job-signal-tracker-ids';
const trackedIds = () => new Set(JSON.parse(localStorage.getItem(trackerKey) || '[]'));
const saveTrackedIds = (ids) => localStorage.setItem(trackerKey, JSON.stringify([...ids]));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const date = (value) => value || 'Not listed';
const appliedDate = (id) => localStorage.getItem(`applied-date:${id}`) || 'Not applied';
const freshness = (role) => role.sourceFreshness ? `<span class="freshness">Source freshness: ${escapeHtml(role.sourceFreshness)}</span>` : '';

function roleCard(role) {
  const domain = companyDomains[role.company] || role.applicationUrl;
  const logo = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  return `<article class="role-card">
    <div class="role-head"><div class="company-line"><img class="company-logo" src="${logo}" alt="${escapeHtml(role.company)} logo" loading="lazy"><div><p class="eyebrow">${escapeHtml(role.employmentType)} · ${escapeHtml(role.category)}</p><h3>${escapeHtml(role.title)}</h3><p class="company">${escapeHtml(role.company)} <span>·</span> ${escapeHtml(role.location)}</p></div></div><span class="priority ${role.priority.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(role.priority)}</span></div>
    <p>${escapeHtml(role.whyItFits)}</p>
    <div class="meta"><span>Posted: ${date(role.postedDate)}</span><span>Discovered: ${role.discoveredDate}</span>${freshness(role)}</div>
    <a href="${escapeHtml(role.applicationUrl)}" target="_blank" rel="noreferrer" data-track-role="${escapeHtml(role.id)}">Open application</a>
  </article>`;
}

function trackerRow(role) {
  const status = role.applicationStatus;
  return `<div class="tracker-row" role="row">
    <strong>${escapeHtml(role.company)}</strong>
    <a href="${escapeHtml(role.applicationUrl)}" target="_blank" rel="noreferrer">${escapeHtml(role.title)}</a>
    <span>${escapeHtml(role.employmentType)}</span>
    <span>${appliedDate(role.id)}</span>
    <select aria-label="Status for ${escapeHtml(role.title)}" data-id="${escapeHtml(role.id)}"><option ${status === 'New' ? 'selected' : ''}>New</option><option ${status === 'Applied' ? 'selected' : ''}>Applied</option><option ${status === 'OA' ? 'selected' : ''}>OA</option><option ${status === 'Interview' ? 'selected' : ''}>Interview</option><option ${status === 'Rejected' ? 'selected' : ''}>Rejected</option><option ${status === 'Offer' ? 'selected' : ''}>Offer</option></select>
  </div>`;
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
  fullTimeGrid.innerHTML = fullTimeRoles.map(roleCard).join('') || '<p class="empty">No new full-time roles in this run.</p>';
  internshipGrid.innerHTML = internshipRoles.map(roleCard).join('') || '<p class="empty">No internships cleared the specialization bar in this run.</p>';
  tracker.innerHTML = trackedRoles.map(trackerRow).join('') || '<p class="empty tracker-empty">Open an application from Daily Board to start tracking it here.</p>';
  const trackedFT = trackedRoles.filter((role) => role.employmentType === 'FT').length;
  const trackedInternships = trackedRoles.filter((role) => role.employmentType === 'Internship').length;
  trackerCounts.innerHTML = `<span><strong>${trackedFT}</strong> full-time</span><span><strong>${trackedInternships}</strong> internships</span>`;
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
  role.applicationStatus = event.target.value;
  localStorage.setItem(`status:${role.id}`, role.applicationStatus);
});
document.querySelector('#daily-board').addEventListener('click', (event) => {
  const link = event.target.closest('[data-track-role]');
  if (!link) return;
  const tracked = trackedIds();
  tracked.add(link.dataset.trackRole);
  saveTrackedIds(tracked);
  localStorage.setItem(`applied-date:${link.dataset.trackRole}`, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
  window.setTimeout(render, 0);
});

fetch('./data/jobs.json').then((response) => response.json()).then((data) => {
  roles = data.roles.map((role) => ({ ...role, applicationStatus: localStorage.getItem(`status:${role.id}`) || role.applicationStatus }));
  currentRunDate = data.lastRun;
  document.querySelector('#updated').textContent = `Last scan: ${data.lastRun}`;
  render();
});
