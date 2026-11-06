# Asian Languages (Hindi, Bengali, Indonesian) — AI Draft Review Packet

Date: 2 November 2026
Scope: 59 exact quoted UI messages from `docs/international/translation-followup-source-2026-11-02.json`.
Status: **Unreviewed AI draft**. Not approved for production release, agricultural advice, or runtime enablement.

---

## 1. Candidate Terminology & Agronomic Alignments

These are candidate terms used in this AI draft. A fluent grower reviewer must check whether these fit local smallholder vocabulary and mobile screen layouts. No common or standard regional usage is asserted.

| English Source Term | Hindi (`hi-IN`) Candidate | Bengali (`bn-BD`) Candidate | Indonesian (`id-ID`) Candidate | Agronomic & UI Distinction |
| :--- | :--- | :--- | :--- | :--- |
| **Bed** (cultivated bed) | क्यारी (*kyaari*) | বেড (*bed*) | *bedengan* | Cultivated growing bed in field/garden; NEVER furniture. |
| **Virtual bed** | आभासी क्यारी | ভার্চুয়াল বেড | *bedengan virtual* | Simulated/unmapped planning bed. |
| **Nursery** | नर्सरी / पौधशाला | নার্সারি | *persemaian* | Propagation facility, distinct from open fields. |
| **Tray** (propagation tray) | ट्रे (*tray*) | ট্রে (*tray*) | *baki semai* | Propagation plug container. |
| **Cell** (tray plug) | सेल / खाना | খোপ / সেল | *lubang semai* / *sel* | Individual compartment in a propagation tray. |
| **Open field** | खुला खेत | উন্মুক্ত জমি | *lahan terbuka* | Measured growing polygon without defined beds. |
| **Transplant crop** | रोपाई वाली फसल | চারা রোপণের ফসল | *tanaman pindah tanam* | Crop started in nursery for field transplantation. |
| **Usable starts** | उपयोग योग्य तैयार पौधे | ব্যবহারযোগ্য চারা | *bibit siap tanam* | Seedlings ready for field planting. |
| **Planning forecast** | योजना पूर्वानुमान | পরিকল্পনার পূর্বাভাস | *prakiraan perencanaan* | Model estimate, NOT observed live nursery inventory. |

---

## 2. Candidate-Term Questions for Grower Reviewers

### Hindi (`hi-IN`)
1. **Bed terminology:** Does the candidate term क्यारी (*kyaari*) clearly distinguish a cultivated growing bed from open field areas for smallholders in the target pilot area?
2. **Tray cell plugs:** Which candidate term is clearer on a mobile interface when entering cell count per container: सेल (*cell*) or खाना (*compartment/socket*)?
3. **Nursery facility:** Does नर्सरी or पौधशाला better convey a plant propagation space without confusion with open field blocks?

### Bengali (`bn-BD`)
1. **Bed terminology:** Does the candidate term বেড clearly indicate a cultivated field growing bed, and is it distinct from উন্মুক্ত জমি (open field area) for growers in the pilot area?
2. **Tray cell plugs:** Between the candidate terms খোপ and সেল, which is more readily understood by growers when specifying the cell count of a container?
3. **Nursery facility:** Does the candidate term নার্সারি clearly identify a seedling propagation facility as distinct from field growing blocks?

### Indonesian (`id-ID`)
1. **Bed terminology:** Does the candidate term *bedengan* clearly indicate a cultivated growing bed and remain distinct from open unbedded areas (*lahan terbuka*) for growers in the pilot area?
2. **Nursery facility:** Does the candidate term *persemaian* clearly denote a seedling propagation space as distinct from field planning areas?
3. **Tray containers:** For propagation plug containers, is the candidate term *baki semai* or an alternative candidate clearer on a mobile layout?

---

## 3. Required Human Verification Checks

Before any of these files can be integrated or enabled in production:
- [ ] **Physical Layout vs. Equipment:** Verify that cultivated field beds, propagation trays, plug cells, nursery areas, and open field blocks are never conflated.
- [ ] **Data States:** Confirm local device storage is distinguished from account/cloud confirmation.
- [ ] **Estimates vs. Live Counts:** Ensure planning estimates and forecasts are never phrased as observed live nursery inventory.
- [ ] **Unknown vs. Zero:** Confirm that unentered/unknown values remain distinct from numerical zero.
- [ ] **Protected Tokens:** Ensure all literal units (`cm`, `m`, `m²`, `%`, `degrees`, `0–100`), numbers (`0`, `52`), and keywords (`DEMO`, `CSV`, `ImbewuField`) remain strictly preserved without transliteration.
- [ ] **Reviewer Sign-off:** Record the named reviewer, date, dialect, and feedback before any runtime enablement.
