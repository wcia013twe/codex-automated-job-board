import { readFile } from 'node:fs/promises';

const required = ['id', 'company', 'title', 'employmentType', 'location', 'category', 'priority', 'discoveredDate', 'whyItFits', 'applicationUrl', 'applicationStatus'];
const allowedPriorities = new Set(['Apply Now', 'Strong Consider', 'Skip Unless Team Fit']);
const allowedTypes = new Set(['FT', 'Internship']);
const data = JSON.parse(await readFile(new URL('../data/jobs.json', import.meta.url)));
const ids = new Set();
const urls = new Set();

for (const role of data.roles) {
  for (const key of required) if (!role[key]) throw new Error(`${role.id || 'unknown role'} is missing ${key}`);
  if (!allowedPriorities.has(role.priority)) throw new Error(`${role.id} has an invalid priority`);
  if (!allowedTypes.has(role.employmentType)) throw new Error(`${role.id} has an invalid employment type`);
  if (ids.has(role.id) || urls.has(role.applicationUrl)) throw new Error(`duplicate role: ${role.id}`);
  ids.add(role.id); urls.add(role.applicationUrl);
}
console.log(`Validated ${data.roles.length} roles.`);
