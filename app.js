const board = document.querySelector('#board');
const tracker = document.querySelector('#tracker');
const summary = document.querySelector('#summary');
const search = document.querySelector('#search');
const typeFilter = document.querySelector('#type-filter');
let roles = [];

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const date = (value) => value || 'Not listed';
const freshness = (role) => role.sourceFreshness ? `<span class="freshness">Source freshness: ${escapeHtml(role.sourceFreshness)}</span>` : '';

function roleCard(role, detailed = false) {
  return `<article class="role-card">
    <div class="role-head"><div><p class="eyebrow">${escapeHtml(role.employmentType)} · ${escapeHtml(role.category)}</p><h3>${escapeHtml(role.title)}</h3><p class="company">${escapeHtml(role.company)} <span>·</span> ${escapeHtml(role.location)}</p></div><span class="priority ${role.priority.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(role.priority)}</span></div>
    <p>${escapeHtml(role.whyItFits)}</p>
    <div class="meta"><span>Posted: ${date(role.postedDate)}</span><span>Discovered: ${role.discoveredDate}</span>${freshness(role)}</div>
    ${detailed ? `<div class="status-row"><label>Status <select aria-label="Status for ${escapeHtml(role.title)}" data-id="${escapeHtml(role.id)}"><option ${role.applicationStatus === 'New' ? 'selected' : ''}>New</option><option ${role.applicationStatus === 'Applied' ? 'selected' : ''}>Applied</option><option ${role.applicationStatus === 'OA' ? 'selected' : ''}>OA</option><option ${role.applicationStatus === 'Interview' ? 'selected' : ''}>Interview</option><option ${role.applicationStatus === 'Rejected' ? 'selected' : ''}>Rejected</option><option ${role.applicationStatus === 'Offer' ? 'selected' : ''}>Offer</option></select></label></div>` : ''}
    <a href="${escapeHtml(role.applicationUrl)}" target="_blank" rel="noreferrer">Open application ↗</a>
  </article>`;
}

function render() {
  const needle = search.value.toLowerCase();
  const type = typeFilter.value;
  const visible = roles.filter((role) => (!type || role.employmentType === type) && `${role.company} ${role.title} ${role.category} ${role.location}`.toLowerCase().includes(needle));
  const applyNow = visible.filter((role) => role.priority === 'Apply Now').length;
  summary.textContent = `${visible.length} roles · ${applyNow} apply now`;
  board.innerHTML = visible.map((role) => roleCard(role)).join('') || '<p class="empty">No matching roles.</p>';
  tracker.innerHTML = visible.map((role) => roleCard(role, true)).join('') || '<p class="empty">No matching roles.</p>';
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

fetch('./data/jobs.json').then((response) => response.json()).then((data) => {
  roles = data.roles.map((role) => ({ ...role, applicationStatus: localStorage.getItem(`status:${role.id}`) || role.applicationStatus }));
  document.querySelector('#updated').textContent = `Last scan: ${data.lastRun}`;
  render();
});
