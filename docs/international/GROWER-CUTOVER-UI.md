# Crop-plan storage lifecycle and inline review

The global `CropPlanStorageProvider` runs underneath the actual Auth and Language
providers. It imports only the lightweight storage authority, Auth and React; it
does not pull the crop catalogue or demo farm into every route. Notices in the
production planner, Task Planner, Calendar and Records Charts consume this one
delivery. Each notice sits within existing scrolling content, rather than a fixed
strip over controls. The Finance teaching course is unchanged.

The provider waits for account loading and observes the mounted UID and sample
event. Account/sample cleanup and pagehide revoke its private context before
releasing document leases. A queued operation cannot retain authority after
cleanup. A BFCache pageshow requests a fresh context and lease. Passive focus and
storage events inspect current status; they do not automatically import, recover,
reconcile or retry a save. Status changes notify existing crop-plan consumers so
their prior loaded admissions are withdrawn. Unchanged status does not create an
event loop. Repeated screen notices do not acquire additional leases.

Pagehide also withdraws the provider's previous readiness comparison. A newly
acquired lease therefore emits readiness even when stored bytes and visible
status have not changed. An actual mounted provider/Task Planner hook regression
reproduced the earlier omission: tasks remained held after resume despite a
writable new lease. The renewed event lets those consumers reread their current
book rather than reviving the old admission.

An account-bound guest-transfer hold prevents automatic setup of an empty target.
Explicit Retry awaits the Auth migration callback first, then checks the still
current context before requesting storage setup. A React account transition after
that await invalidates the earlier operation. The core barrier remains the
authority even if another caller bypasses this UI.

Read-only notices distinguish another editor, unsupported browser protection,
unreadable legacy evidence, interrupted setup and changed context. Explicit
recovery invokes only the core frozen-receipt recovery helper and then reacquires
editing authority. It cannot replace an existing canonical plan or silently
reimport a newer legacy copy.

## Older-copy review

The provider holds the original opaque legacy-review object privately. It exposes
only raw saved-row counts, an epoch for revoking confirmation and bound actions.
Equal counts do not establish equal dates, quantities or settings, or verify a
planting record. Changed source bytes revoke the downloaded proof and checkbox,
including when displayed counts remain equal.

The download comes only from the core proof-bound exporter. Its exact authored
copies are written to a local JSON download; the UI adds no network request,
physical storage key or account ID and never renders raw payloads. Farmer-authored
values inside their own export may still be private. Download failure grants no
choice. The grower must download the copies and explicitly confirm the protected
plan before choosing **Keep current plan; retain older copy for later review**.
This calls the core helper, never a parallel merger or proof check. A confirmed
result states that older changes were not merged. An unconfirmed performed choice
withholds repeated actions, including retained callbacks, and asks the grower to
reload and inspect their copies. This is not automatic agronomic or human review.

## Verification boundary

The production planner handles storage changes after its pending React edits have
committed. Its event listener advances a revision; a separate committed effect
handles each revision once. A clean display must exactly match its captured base
before a fresh ready admission can refresh saved content and clear the initial
setup hold. A dirty display, unsafe load or changed actor/sample remains visible
under a hold. Readiness cannot bless the original inadmissible base or overwrite
unsaved inputs. Its own synchronous save events are processed after the actual
writer receipt and state update, so a successful save cannot manufacture an
external conflict or an autosave loop. Revocation cancels queued autosaves.
If genuinely different saved content refreshes a clean view, pending catalogue
proposals, open row-edit controls and their undo bindings are invalidated: their
old occupancy is no longer current. Retained open/generate/accept callbacks also
check the exact original displayed book against the current admitted base and
token, rather than relying on unchanged geometry alone. A lease renewal with the
same saved content preserves legitimate inputs and history; a dirty view is
never cleared by this refresh.

Actual core/parent-handler integration tests separately execute cold mount before
setup, readiness followed by a real edit/save, dirty-input preservation, newer and
corrupt saved content, actor transitions, volatile lease/admission renewal and
event cleanup. These tests control unrelated screen startup and React's state
commit/timer boundary; they do not claim a complete browser-mounted page.

Mounted component tests exercise actual lifecycle handlers, private context
revocation, retries, recovery, downloaded-proof confirmation and stale/superseded
outcomes with controlled storage/auth boundaries. Core tests separately exercise
real storage and writer protection. Component rendering is not a desktop/phone
visual check: browser access was disabled during this implementation. Responsive
placement, real two-tab/offline/BFCache behavior and account browser checks remain
release gates. This changes the picture; `PLAN_VERSION` is unchanged.
