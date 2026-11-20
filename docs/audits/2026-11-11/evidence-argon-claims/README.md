# Evidence: Argon's claims F-07 and F-09, 11 November 2026

Record: [`../argon-claims-dispositions-claude.md`](../argon-claims-dispositions-claude.md).

| File | What it is |
| --- | --- |
| `exposure-span-recheck.ts` | Frost and heat exposure of every crop, sowing month and place, over the old harness's months and over the bed months the planner reserves. Offline: it reads the archived daily responses of 10 November. |
| `outputs/exposure-span-recheck.txt` | Its output: both counts and every named difference. |

To run it: extract `../../2026-11-10/evidence-crop-plan-accuracy/outputs/raw-responses-2026-11-10.tar.xz` into an empty directory, then

```
RAW=<that directory>/cache node --import ./tests/register-alias.mjs docs/audits/2026-11-11/evidence-argon-claims/exposure-span-recheck.ts
```

The review package itself (`codex-argon-new-claims-9a5b102e.zip`, sha256 `e7d2588a…cb4de`) is not copied into the repository. Its runner was read, not executed.
