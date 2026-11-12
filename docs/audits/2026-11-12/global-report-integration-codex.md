# Combined global preview and report correction candidate

This integration starts from current production source
`fa2d646d08cd273d634cedcc10bb2b4dc8ed2b65`, incorporates the global preview at
`600d7e17516c156d33dcb75ce120f0c950f28354` (draft PR1347), and the soil/save/report
correction stack at `06a219eea68c1ac8ef17fe22cc674f2b06e71d3e` (draft PR1346).
The combined merge before this audit is `960e5a52c`.

## Merge decisions

Both parents and current main changed the same long test command. The resolution
keeps the runner and its flags unchanged and takes the union of all 898 test-file
arguments. All other package entries are exactly equal. In particular, current
main's water-year and crop-gate-year tests are retained. No dependency upgrade,
test removal or workflow change is part of this integration.

The audit indexes retain both parents' entries. Release notes retain both stacks
and add a combined summary. The crop page merged without a text conflict; its
current preview bindings still require the current actor, account/site, confirmed
country/region, measurement receipt and context revision. This is a source check,
not proof of an authenticated farmer session.

The actual provisional preview, source adapters, resolver/export, report PDF,
risk/document builders, generate-report route, report view and data panel have
the same Git blobs as their respective reviewed parents. Their original output
inspections remain traceable; the new combined candidate still needs its own
applicable tests, CI and independent integration review.

The first combined pass reported 285/287 tests passing. Both failures were outage
tests whose demo clone now inherits current main's explicitly complete NASA
temperature coverage. Their missing-temperature condition is now set explicitly;
the assertions are retained. A further real-footnote case checks that a rainfall
outage preserves independently supported temperature while withholding the
unsupported climate class and rainfall seasons. Product evidence rules are not
relaxed to accommodate the tests.

Current main's Tests run 43175034641 completed all 10,678 tests with zero failures
and skips, then failed its release-note drift check for nine user-facing changes.
This is not a failing-test result. The combined notes include the example farm's
water-year view, monthly climate gate explanation, rain film and phone scrolling;
the original test/security gates remain enabled. Final combined affected tests
pass 288/288, including the new independent-temperature outage case. That count
does not substitute for the combined commit's full CI result.

## Remaining gates

The shared source packet records typechecking, affected integration tests,
original output lineage and exact source hashes. A focused local pass is not a
full-suite result. The current-head full test job and security/preview checks must
be assessed on the final pushed commit. The earlier preview workflow's Node20
heap failure is not cleared by a separate Vercel deployment passing.

Independent Codex reviews of the rainfall judgement and PDF header corrections
are bounded to those deltas. Cowpea and combined integration reviews are separate.
Claude/AGY same-candidate reviews have not run; automatic AGY consumer-login calls
remain disabled under the service/access-policy hold. None of these tests or AI
reviews establish agricultural accuracy, fluent native comprehension, planting
permission or release approval. No paid report/render call or authenticated farm
data inspection has occurred. No production data or saved geometry was changed.

The provisional planner remains a preview with editable grower estimates and
explicit missing values. The two Kenya method references are source connections,
not global numeric recommendations. Broader regional coverage and independently
validated agricultural evidence remain requirements of the ongoing programme.
