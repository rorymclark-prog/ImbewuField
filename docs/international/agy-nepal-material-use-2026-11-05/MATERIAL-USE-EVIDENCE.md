# Nepal: Public Awareness Material Use Notice Evidence

Coordinator public fetches (manifest `7529c6718358156dd4155e71a7d817f700d2139f25d4a79b6b707f0403245a9e`, 2026-11-05 15:07 UTC) retrieved two distinct AITC notice HTML pages:
- `notice-386`: `https://aitc.gov.np/content/386/regarding-use-of-public-awareness-material/` (HTTP 200)
- `notice-385`: `https://aitc.gov.np/content/385/regarding-the-use-of-public-awareness-material/` (HTTP 200)

### Findings from Supplied Page Bodies
- Both pages advertise the same Nepali title (*केन्द्रद्वारा उत्पादित जनचेतनामूलक सामग्री प्रयोग सम्बन्धमा*) and advertised publication date (*२० असोज, २०८३*).
- In both HTML bodies, the notice content container (`.details__desc`) contains only a single embedded `<img>` tag pointing to an external public image URL (`https://giwmscdnone.gov.np/media/albums/WhatsApp%20Image%202026-10-06%20at%203.02.07%20PM_ILb7NV7FnL_8bpiomw.jpeg`).
- **No readable text of use conditions was found in the supplied notice body or derived text.** The body is an unretrieved image; its actual wording and legal effect remain unverified. A notice title about material use is not itself permission.
- The two distinct URLs reference identical image markup, but verifying identical notice documents requires inspecting the actual graphic payload.

### Unknowns & Next Steps
- Commercial reuse, attribution requirements, modification, translation, and distribution conditions remain **UNKNOWN**.
- *Smallest Next Verification*: Perform normal HTTPS fetch and human/legal review of the referenced notice image graphic to transcribe actual terms.
- *Proposed Negative Controls (Not Executed)*:
  1. Reject assuming open reuse from a notice title alone.
  2. Block automated ingestion when notice terms are encapsulated in uninspected image/PDF attachments.
  3. Prohibit treating distinct URLs with identical image tags as legally settled without payload verification.

Documentation-only, unreviewed AI draft; no fluent/local legal approval, customer testing, runtime activation, or API integration.

```json
{
  "status": "documentation-only",
  "manifestSha256": "7529c6718358156dd4155e71a7d817f700d2139f25d4a79b6b707f0403245a9e",
  "review": "unreviewed-ai-draft",
  "commandsRun": false,
  "testsRun": false,
  "validation": "UNKNOWN",
  "workersActive": 0,
  "runtimeActivation": false,
  "countrySupported": false,
  "productApiImplemented": false
}
```
