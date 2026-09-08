# Tour, invoices and visit capture

User-requested changes prepared on 8 September 2026.

- New quick sales save a paid invoice before synchronising deterministic invoice sales rows. Failed sync retains the invoice with a retry action. Draft/unpaid multi-item invoices use the full invoice editor. Existing legacy sales are not silently converted.
- Orchard examples use the existing perennial produce catalogue, tagged `other` so fruit income is not divided by vegetable-bed area. All demo invoices refer to the same sales, avoiding duplicated income.
- Home's tour invitation appears for the first 30 document openings, per account per browser. Internal navigation and repeated React effects do not count. On opening 30 a dismissible modal points to the menu. A pending reminder remains available on Home until acknowledged. Clearing browser data or changing device starts a new count.
- Take a tour and Tips & help remain at the top of the menu. No published app-specific YouTube walkthrough was found; the video area currently labels its external gardening search honestly.
- Mentor visits support phone-keyboard dictation guidance, optional reviewed grammar cleanup (original retained), and three compressed JPEG photos with captions. Photo data is saved separately from visit metadata and fetched only when that visit is opened. Reports include photos that have been opened. Existing organisation/mentor assignment checks apply to photo access too. No raw audio recording is sent or stored.

## AI controls and providers

Settings controls each account's paid AI tools on that browser. Disabled feature names travel with authenticated requests; the common guard rejects them before any provider call. Ordinary record writes and polling already-generated images remain available.

Operators can disable all paid app AI with `PAID_AI_ENABLED=false`, or use `AI_CHAT_ENABLED`, `AI_RECEIPTS_ENABLED`, `AI_REPORTS_ENABLED`, `AI_NOTES_ENABLED`, `AI_PHOTOS_ENABLED`, and `AI_DESIGNS_ENABLED` set to `false`. These are server configuration controls, independent of the browser preferences. They do not cancel a provider request already running.

Receipt extraction and visit-note cleanup use a separate low-cost helper. `LOW_COST_AI_PROVIDER=gemini` uses `gemini-2.5-flash-lite` with the existing server `GEMINI_API_KEY`; `anthropic` uses `claude-haiku-4-5` with the existing `ANTHROPIC_API_KEY`. If no provider is selected, a configured Gemini key selects Gemini; otherwise Anthropic is selected. No new credentials are created. No automatic fallback to a dearer model or SDK retry is enabled. Advanced report routes keep their existing model. Usage is logged through `logAiUsage`.

Published model-only estimates, checked 8 September 2026:

| Task and assumptions | Gemini Flash-Lite | Claude Haiku 4.5 |
| --- | --- | --- |
| 15 receipts; each 2,000 input / 200 output tokens | US$0.0042 | US$0.045 |
| One note cleanup; 1,000 input / 600 output tokens | US$0.00034 | US$0.004 |

At an illustrative R18/US$, these are R0.076 / R0.81 for 15 receipts, and R0.006 / R0.072 per cleanup. Actual usage varies with images, note length and retakes. Hosting, storage and taxes are separate. Phone keyboard dictation adds no app transcription API charge. As a separate option, OpenAI lists gpt-4o-mini-transcribe at US$0.003/minute; it has not been integrated or provisioned here.

Sources: https://ai.google.dev/gemini-api/docs/pricing and https://platform.claude.com/docs/en/about-claude/pricing and https://developers.openai.com/api/docs/pricing .
