# Records, studies and tour review — 7 September 2026

Rory requested compact mobile pages, stronger graphics and contrast, a complete profitable
walkthrough, inspectable invoices/receipts, and easier gate controls. These changes are confined
to presentation, the existing isolated sample data and the receipt reader's usage logging.

## Implemented in this branch

| Area | Change |
| --- | --- |
| Phone navigation | Shared 52 px top bar. Settings, page help and role choices stay accessible in the menu. |
| Mentor | Single-line Training / Field team / Trainees / Messages tabs; simple mobile heading; Groups, Farmers and Visits in one grid. |
| Programme evidence | Seventeen progress indicators across all seven work areas, with dated observations and evidence notes. Seven visits populate the mentor teams. |
| Studies | My Studies heading, illustrated module cards, artwork beside every lesson, compact progress and expandable offline downloads. Lesson content and prerequisites are preserved. |
| Records | Lighter dark cards; readable cream panels and chart headings; crop illustrations; current-month harvest, turnover and price for all planned crops. |
| Saved sites & reports | Each site card has a miniature of its own saved layout, bed/plot counts and crop illustrations. It opens that site's crop plan; an empty plan offers a starting point. |
| Report history in the tour | Save, reopen, update and delete report snapshots in the existing disposable sample store. History remains available during exploration and clears when the workspace is restarted; the account's real reports are untouched. |
| Report cover and evidence forms | The screen loads the original saved map instead of stretching its 240 px thumbnail. Full-colour PDF uses a print-sized map on its cover when no site photo or captured satellite image exists. Soil/water evidence forms have dark text on their cream surface in either theme. |
| Example books | Profitable invented practice records, with sale and harvest quantities coordinated. Every sale has a paid invoice; the cash ledger counts it once. |
| Documents | Invoice number and View action open the saved invoice. Expense receipts are drawn from their matching sample expense. The tour can preview/export a lender summary; its cash totals now include all paid invoices once, while crop weights retain only recorded kilograms. |
| Lima receipts | Prepared receipt fills the demo expense form without an API call. Existing real scanner now records provider token cost in server logs. |
| Design Map | Replaces Exact Canvas in ordinary preview controls. Paid AI maps remain gated. |
| Gates | Dedicated move handle, wider touch area, no pointer jump, length-only controls. Finished fence/property lines stop at the opening and the leaf is drawn open. |
| Tour | Arrival opens a dimmed, dismissible feature dialogue, with short tips and Try it now. |
| Tour wording | Evidence and assessment pages use normal headings and actions such as Save edits and Download evidence report. The overall Sample badge and source captions remain. |

This changes the rendered map picture. `PLAN_VERSION` is deliberately untouched; the repository's
merge owner assigns that shared version. No geometry is written during painting.

The actual editable Ubhejane master and its original drone underlay were not available in this
checkout or the supplied project files. The recovered map bundles contain flattened/annotated
images, which are not substitutes for that original. The existing synthetic tour design remains
in place. Do not describe it as a newly imported copy of the owner's master. A design export with
the original image is still required to prepare that exact tour copy. The master was not edited.

## Invoice and production recommendation

Make the main sale flow **Record sale → Confirm quantity and buyer → Invoice or receipt → Save**.
Ask whether a paper invoice already exists; retain its number and photograph as the source instead
of creating a second transaction. Let the user choose the actual sale/payment dates for past sales.
An unpaid invoice records money owed; payment records cash received. The paid invoice's stable ID
and line ID must link to the sale and prevent duplicate counting.

Keep Picked as a separate production event, then account for sold, used at home, donated, spoiled
and remaining produce. A sale is not a second harvest. Allow counts, bags, crates and bunches when
weight is unknown, with measured/estimated quantity status. Convert containers to kilograms only
when a measured tare and representative net weight are available; retain the original units.

A photo of a pile cannot reliably establish its mass: unseen produce, pile depth, size variation
and density all matter. Use photos as evidence, with counts or container estimates where needed.
Budget for an accessible shared project scale with suitable capacity, tare and routine checks.
Farmers should still be able to record produce while waiting for a scale. Published potato imaging
work uses controlled RGB-D/3D arrangements and identifies occlusion as a difficulty; it does not
validate arbitrary phone photographs of piles as accurate weights.

Source: [3D potato phenotyping research](https://arxiv.org/html/2512.24193v1).

## Offline status and work required

The web app already has a service worker, downloadable study media, persistent Firestore caching
and local invoice storage. This is partial offline support, not evidence that every screen works
from a cold start without signal. `/records` and `/invoice` are not explicitly in the service
worker's initial page precache. Cloud AI reading and map tiles that were not downloaded need a
connection. Current invoices are device-local; do not promise that they appear on another device.

For a dependable field workflow, download the chosen workspace before departure; store draft
records and receipt/photo blobs in IndexedDB; show Saved on phone / Waiting to sync / Synced;
retry with stable record IDs on reconnect and on the next app opening. Test airplane mode after a
reload, after closing/reopening the app, with queued photos, and across account switching. Do not
depend on background sync while an iPhone app is closed. The existing receipt reader extracts
item, total and supplier but does not persist the source photograph with the expense yet.

Source: [MDN offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

## Receipt AI cost and organisation controls

The current `/api/read-slip` uses Claude Sonnet 4.6, capped at 400 output tokens. The figures below
are planning examples, **not measured bills**: assume 2,000 total input tokens and 300 output
tokens per receipt, without caching, retries, hosting, storage or tax.

| Option | Published USD per million input / output tokens | Example USD per receipt | Example USD for 1,000 receipts |
| --- | --- | --- | --- |
| Current Sonnet 4.6 reader | $3 / $15 | $0.0105 | $10.50 |
| Haiku 4.5 candidate, subject to accuracy testing | $1 / $5 | $0.0035 | $3.50 |

Long receipts, larger images and retries change the token count. Usage is now logged so a small
real pilot can replace these assumptions. Keep receipt capture/viewing available without AI;
make automatic reading an organisation option with a monthly allowance and hard spending cap.
Enforce entitlements and budget reservations on the server, not only by hiding a switch. Keep
separate allowances for receipt reading, report generation and any future AI map option.

Sources checked 7 September 2026: [Anthropic pricing](https://claude.com/pricing),
[image input guidance](https://platform.claude.com/docs/en/build-with-claude/vision).

Ordinary Design Maps use local drawing and have no image-model charge. Future AI images should
be metered separately: Google's published Gemini 3.1 Flash Image output prices range from about
$0.045 at 512 px to $0.15 at 4K, before input and retries. A multi-sheet plan can incur several
generations. Preprepared demo receipts and illustrations require no model call per view.

Source: [Google image API pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Reusable visual report opportunities

Use shared components across site reports, with real site data supplying labels and quantities.
Full-colour print should preserve the screen's visual story using static equivalents. Eco print
should retain useful figures and diagrams, remove heavy fills and optional photographs, and
substitute compact tables where needed. Missing evidence should offer an action, never a made-up
measurement. Catalogue art must remain distinguishable from photographs of the actual site.

| Report content | Recommended visual | Needed source | Eco print |
| --- | --- | --- | --- |
| Opening | Site photograph, location inset, compact key figures | Saved site, dated photo | Title and facts |
| Design overview | Full-width plan with numbered annotations | Saved design and underlay | Line plan |
| Location | Locator map, boundary, scale and north | Saved coordinates and boundary | Small outline map |
| Existing vs proposed | Side-by-side images or screen toggle | Same-site photo and saved plan | Optional outlines |
| Evidence quality | Checklist of photos, surveys, soil/water tests and design completion | Actual saved evidence | Compact checklist |
| Seasons | Monthly rainfall bars and temperature line | Sourced site climate values | Monochrome chart |
| Sun and exposure | Sun path and shaded-area diagrams | Site coordinates and saved obstacles | Line diagram |
| Terrain | Contours, slope arrows, marked drainage | Survey/terrain source and resolution | Contour lines |
| Water supply | Sources → storage → use diagram | Recorded sources and capacities | Simple flow diagram |
| Water budget | Supply/demand chart with assumption key | Measured/estimated inputs identified | Chart and totals |
| Soil | Test-result ranges, sample-point map | Actual laboratory results and dates | Results table |
| Growing areas | Area comparison bars and labelled bed plan | Saved measured design | Bars and area table |
| Crops | Illustrated crop cards, bed labels, sow/harvest calendar | Catalogue and saved planting rows | Text calendar |
| Trees | Species illustrations and canopy-size diagrams | Checked catalogue, saved tree selections | Names and spacing |
| Plant communities | Layered guild/food-forest schematic | Checked recommendations | Line schematic |
| Vegetation | Existing plant photos and restoration-area map | Site survey and recorded plants | Checklist and outline |
| Production | Crop yield bars and harvest trend | Logged harvests and quantities | Simple bars |
| Produce destinations | Sold/home use/donated/lost/remaining breakdown | Reconciled destination records | Quantity table |
| Finance | Income/cost chart, cash margin, invoice/slip drill-down | Dated sales, expenses and invoices | Monochrome chart |
| Progress | Milestone timeline, dated before/after photo pairs | Verified actions and dates | Timeline and captions |
| Risk | Prioritised risk cards placed on the plan | Assessment and survey findings | Ranked list |
| Action plan | Ordered work phases and responsibilities | Approved design and resources | Compact sequence |
| Funder outcomes | Targets vs actuals across production, reach, income and training | Defined programme indicators and evidence | Indicator table |

Prioritise the plan, site photographs, crop/tree imagery, climate chart, evidence checklist and
action timeline. Add soil, water and financial visuals as the necessary records become available.
Avoid decorative gauges with invented scores or photographs that imply unrecorded site conditions.
