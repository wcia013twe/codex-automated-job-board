# Job Signal Board maintenance

- `data/jobs.json` is the source of truth. Update data before touching the UI.
- On the first run, build the two-tab UI only if it is absent. Later runs should normally only update `data/jobs.json`.
- `Daily Board` shows only roles whose `discoveredDate` matches `lastRun` and which have not been opened by the user. `Auto Tracker` is client-side and receives a role only after the user opens its application link. Automation runs should update `data/jobs.json`, not pre-populate Auto Tracker.
- Deduplicate by canonical application URL and then by normalized company/title/location.
- Preserve every existing `applicationStatus`; only new records start as `New`.
- Valid priorities: `Apply Now`, `Strong Consider`, `Skip Unless Team Fit`. Valid types: `FT`, `Internship`.
- Set `postedDate` to `null` if the source does not disclose it. Do not invent dates. Record result recency in `sourceFreshness` and label anything older than 72 hours in that field.
- Use SimplifyJobs’ Summer 2027 Internships list and HiringCafe as lead sources. Treat both as discovery inputs only: verify availability, job details, and the canonical application URL on the employer or ATS page before recording a role.
- When a company has both internship and new-grad roles, do not automatically recommend both. Prefer the internship when full-time entry is substantially harder and the internship offers a strong conversion path or uniquely valuable specialization. Prefer full-time when the new-grad role is realistically attainable and an internship would not justify delaying graduation. Include both only when each independently clears its own bar.
- Together AI exception: a core inference, training infrastructure, ML systems, platform, kernels, compilers, scheduling, hardware-utilization, or model-systems internship is worth serious consideration as a graduation-delay candidate. Treat generic SWE, frontend, API-integration, generic internal-tooling, or low-depth solutions work as insufficient. Evaluate the exact team and scope before applying the exception.
- Run `npm run validate:data` before committing. Commit and push only the relevant dashboard/data changes.
