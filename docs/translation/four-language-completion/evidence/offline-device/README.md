# Offline page and sync badge: draft evidence

Parent: `991ab513fd7e0c579ec400ba4a3ed29353704375` (#1048).
`offline-device-drafts.json` records 84 source pairs and 267 native values: the 72 device-page
entries in Sesotho, Xitsonga and Tshivenda; the missing isiZulu connected sentence; native
source/review labels and short badge captions; and eight additional exact device/service errors
in all four targets. Existing isiZulu page wording stays exact except two titles aligned from
the retired Offline & sync name to the current source Saved on this phone; their prior wording
is recorded. English stays exact.
These are **unreviewed AI drafts**, without fluent-speaker approval.

The actual `/offline` page is opened in disposable browser contexts at 390 × 844 and 1440 × 1000,
in all four languages. Each context has explicit synthetic onboarding/consent preconditions;
this batch does not re-test those flows. Service workers are blocked to exercise the real
first-start availability error. Online, preparation-error and offline states make 24 actual
page states. Offline mode disables Prepare and Send, and the actual menu badge has a complete
native label inside the viewport. No real account, permission, upload, server write or paid
service is used.

The six additional queue states—waiting/sending/review, removal confirmation, Simple, offline,
completed send, and an active send lease—use host markup from the actual component and real
React hooks/handlers, with isolated field services and synthetic records. AppHeader and TabBar
are stubs in these fixtures; they are not screenshots of a signed-in production workspace.
Actual guest-page checks above separately include the real header, menu badge, bottom navigation
and floating controls. The queue fixtures make 48 browser states at the same phone/desktop sizes.
The source and application CSS/fonts are used, and representative images in every target were
visually inspected. The long removal warning retains its English source and its distinction
between the local queued change and the server record.

`browser-qa.json` measures 13,900 text lines across the 72 states. Source disclosures are opened
before measurement. Each rendered text line is scrolled into view and hit-tested: no tested
line is clipped or occluded at its reading position; there is no document overflow or raw
count/page placeholder. This does not mean all content fits in one viewport, or that a floating
control never overlaps an intermediate line before scrolling. Phone source toggles retain the
44-pixel minimum target. The initial measurement attempt included newly collapsed source text;
the completed measurements expand every disclosure first.

`language-switch-qa.json` checks an already-visible preparation error through all four targets
without reloading, using the app's actual language-change event and provider. Native heading,
error and content-language metadata update together. Progress/errors now retain keys or exact
source text in local React state; page names are translated during rendering. Durable queue
records and unknown user/server text remain unchanged. Unknown text is marked with unknown
language rather than labelled as a native translation.

The registered tests exercise actual hooks, callbacks and actions: all three queue states;
default Simple/All tools behavior; exact downloadable JSON; keep/remove and active-lease gates;
late removal and in-flight preparation across an account switch; every known error and raw
unknown errors; preparation gaps and successful preparation; complete authorised visit-page
pagination and photo routes; and completed messages after changing language. Service, queue, scope, cache and worker files were verified against their recorded pre-batch
hashes; those records do not freeze future service fixes. Actual field-client behavior tests remain. Historical Study hashes stay
unchanged after reversing only the complete exact declared UI layer. Altered/partial drafts and
unrelated learning changes remain visible to the original guards. Old tests pinning the literal
English source prefix or a 40-character JSX distance now guard actual target size and actual
Simple/All-tools visibility instead.

Validation: clean typecheck, 551 tests passed across 63 selected registered files, plus the
registry/manifest check. The full registered suite has 551 files; a complete current-head
success is not claimed. The older 547-file run at `6446f1cb` has finished: 5,445 passed, three failed and one pre-existing
TODO. Its three failures (release-note length, the old Simple helper-name regex and a stale CSV)
were already repaired in predecessor heads and pass in the current focused run. A fresh full run
is required at the finished head. The pending-source CSV was regenerated through
the unchanged script and retains blank human-translation cells.

No Study media or PDF changed. Unmapped service/browser errors elsewhere and wider workflows
still need work. This changes the picture; `PLAN_VERSION` is unchanged.
