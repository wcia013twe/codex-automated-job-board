# Job Signal Board maintenance

- `data/jobs.json` is the source of truth. Update data before touching the UI.
- On the first run, build the two-tab UI only if it is absent. Later runs should normally only update `data/jobs.json`.
- `Daily Board` is the set of roles whose `discoveredDate` is today. `Auto Tracker` is the complete deduplicated history.
- Deduplicate by canonical application URL and then by normalized company/title/location.
- Preserve every existing `applicationStatus`; only new records start as `New`.
- Valid priorities: `Apply Now`, `Strong Consider`, `Skip Unless Team Fit`. Valid types: `FT`, `Internship`.
- Set `postedDate` to `null` if the source does not disclose it. Do not invent dates. Record result recency in `sourceFreshness` and label anything older than 72 hours in that field.
- Run `npm run validate:data` before committing. Commit and push only the relevant dashboard/data changes.
