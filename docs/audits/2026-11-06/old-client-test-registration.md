# Old-client test registration repair

The full run at `21180313fe0289187b84a48374038d7dc012c0e7` completed with 8,544 tests: 8,542 passed, two manifest checks failed, zero TODO. The existing portable historical fixture executed the old-client cases through an `.mjs` wrapper, while both repository registration guards correctly required the provider `.test.ts` path itself to be listed.

The canonical command now registers `shape-sync-v2-old-client.test.ts` directly. Its sole additive setup import loads the renamed non-test helper; the helper no longer imports the provider. This executes all ten original old/new-device cases once, without an external checkout or skipped old-device cases. Every original provider case and every historical hash, dependency, fake-backend and cleanup guard is retained. Production code is unchanged.

Coordinator verification: Node 24 typecheck exit 0; the ten original cases, two shape-loss controls and four registration checks pass (16 total, zero failures, skips or TODO). All seven historical source bodies and the archived original loss regression match the actual frozen `5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e` Git object and their pinned byte/hash manifest. Whitespace checks pass.

This focused evidence does not replace a full run on the corrected head. The original failed run remains evidence; the corrected branch must acquire new full CI evidence before release. No rendered UI changes or production release occur in this repair.
