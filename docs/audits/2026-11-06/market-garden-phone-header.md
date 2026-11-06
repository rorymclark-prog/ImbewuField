# Farmer phone header: Design link containment

Existing independent hosted211 screenshots at390px show the Design studio action clipped at the right edge during Tour2/9. The coordinator and independent source reviewer opened the actual preserved phone images and matched their receipt hashes. These are historical screenshots, not rendered proof for the current change.

The farmer header clips overflow; its sample menu grows beside a separate nonshrinking tour badge, while the Design link also refused shrink. On this separate branch based on frozen67527a55756199f335471f545489f97f33181054, only that Design link now shrinks on mobile with44px minimum dimensions. Its icon retains its size, its label uses ellipsis when needed, and the full translated accessible name/title remain available. At md+ the new minima, shrinking, overflow, text-overflow and whitespace behavior are reset to the original behavior. Shared header height/insets and all other header actions remain unchanged.

AGY implemented the one-file scope. Before application the coordinator rejected conflicting minimum-width utilities and a desktop whitespace change; the final diff contains only the approved comment/link attributes/classes/icon/span. Independent byte comparison preserves all other farmer-page content, including href/selected coordinates, translations, explicit action handling and automatic-DEMO Details intent. PLAN_VERSION, measured geometry, calibrated lessons and species are unchanged.

This changes the picture. The current visual result is unverified: the coordinator browser is disabled and no workaround was used. Actual phone/desktop containment, tap targets and label behavior remain required. Existing focused checks and typecheck are recorded separately; no new mirrored implementation test or full-suite claim is made. No production merge.

Source commit `82d75912c5b8231f9e13a8f1432030a812cc3844`; the inherited first release code stamp points to it without changing English or any caption pairs. Frozen combined675 remains a separate current-CI/QA candidate.
