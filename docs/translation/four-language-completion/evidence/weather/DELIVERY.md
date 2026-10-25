# Weather translation draft delivery

The weather widget has source-bound Sesotho, Xitsonga and Tshivenda drafts alongside the original
English source. Existing isiZulu copy, provider parsing, thresholds, cache behavior and weather
figures remain unchanged. Contextual fetch errors retain the distinction between the Home widget
and a report with climate below. Native weekdays and no-rain accessible labels follow the reader.

Actual isolated component/browser verification covered31cases: phone/desktop forecast views,
Home/report errors, zero/missing/clear weather, compact/loading states and the reachable forecast
tail. Screenshots were inspected. A real360px phone overflow was captured and corrected by keeping
hidden no-rain text within each positioned day cell. The captured failing DOM still fails the
regression rule. This changes the picture; PLAN_VERSION is unchanged.

Ordered local verification completed25October2026: typecheck0, full npm test0, diff check0;
5,579passed,0failed,1existing shape-sync TODO (5,580total;564registered files). All11frozen
code/test/document JSON hashes remain exact. `required-checks.json` records the terminal result.
Earlier pending fields in the tested source/evidence packets are historical and are superseded
by this new delivery record; their bytes were kept unchanged through verification.

All native prose remains an unreviewed draft. This main-based branch does not yet contain the
translation stack's canonical update-copy modules. Its5native update-note source pairs are saved
in weather-drafts.json for integration into that existing authority. The PWA release note still
renders in English on this branch. Actual full Home/Farmer/report routes and whole-app coverage
remain unfinished. No account/consent flow, real records, paid AI, backend deployment or merge was
performed. CI must be read after the finished branch push; local success is not CI success.

Staging exposed trailing spaces in16new readable browser AX snapshots. Those copies were
normalized without changing words; their exact raw bytes remain losslessly in
`original-ax-snapshots.json.gz`. The original verification packet and all11frozen inputs remain
unchanged. The new required-checks record links both raw and readable hashes. Cached diff check
was rerun over the actual staged files.
