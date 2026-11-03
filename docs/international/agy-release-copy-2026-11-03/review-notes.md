# Release Copy Review Notes: South African Local Languages (2026-11-03)

Date: 3 November 2026
Scope: Eight exact current country-context release descriptions and update-tour strings from `source.json`.
Locales: isiZulu (`zu`), Sesotho (`st`), Xitsonga (`ts`), Tshivenda (`ve`).
Status: **Unreviewed AI draft**. Not approved for production release, agricultural advice, or runtime enablement.

---

## 1. Candidate Terminology Alignment

These are candidate terms used in this AI draft. A fluent grower reviewer must check whether these fit local smallholder vocabulary and mobile screen layouts. No common or standard regional usage is asserted.

| English Source Term | isiZulu (`zu`) Candidate | Sesotho (`st`) Candidate | Xitsonga (`ts`) Candidate | Tshivenda (`ve`) Candidate | Agronomic & UI Distinction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mapped site** | isayithi ebalazwe | sebaka se 'mapileng | ndhawu leyi mepiweke | fhethu ho mapiwaho | A farmer's site with recorded geometric boundaries. |
| **Unmapped reference** | isikhombo esingabalazwanga | tšupiso e sa 'mapoang | xikombo lexi nga mepiwangiki | tsumbo i songo mapiwaho | Planning workspace without an underlying boundary map. |
| **Crop-planning guidance** | isiqondiso sokuhlela izitshalo | tataiso ea moralo oa lijalo | nkongomiso wo kunguhata swibyariwa | vhulangeli ha u pulana zwilimwa | Agronomic scheduling advice for field crops. |
| **Virtual bed** | umbhede wokutshala owenziwe | bethe e bōpiloeng | bedi ro vumbiwa | mbethe wa maitele | Simulated field planting bed; NEVER domestic sleeping furniture. |
| **South African reference basis** | isisekelo sokubhekisela saseNingizimu Afrika | motheo oa tšupiso oa Afrika Boroa | xisekelo xo komba xa Afrika-Dzonga | mutheo wa tsumbo wa Afurika Tshipembe | Baseline agronomic assumptions derived from South African data. |
| **Nursery equipment** | izinto zasenkulisa | lisebelisoa tsa nesari | switirhisiwa swa narsari | zwishumiswa zwa nese | Seedling propagation trays, pots, and nursery gear. |

---

## 2. Candidate-Term Questions for Grower Reviewers

### isiZulu (`zu`)
1. **Virtual bed:** Does the candidate phrase *umbhede wokutshala owenziwe* clearly convey an unmapped or simulated planting bed without confusion with household furniture?
2. **Reference basis:** Is *isisekelo sokubhekisela* clear to smallholder growers when describing baseline agronomic calculations?
3. **Nursery equipment:** Does *izinto zasenkulisa* clearly refer to seedling propagation tools and equipment?

### Sesotho (`st`)
1. **Virtual bed:** Does *bethe e bōpiloeng* clearly represent an unmapped planning bed for vegetable and crop gardens?
2. **Reference basis:** Is *motheo oa tšupiso* understood in the context of choosing regional planning baselines?
3. **Mapped site:** Is *sebaka se 'mapileng* natural and distinct on mobile screen navigation headers?

### Xitsonga (`ts`)
1. **Virtual bed:** Does *bedi ro vumbiwa* clearly signify a cultivated field bed in a simulated planning layout?
2. **Reference basis:** Does *xisekelo xo komba xa Afrika-Dzonga* accurately reflect the optional South African reference data without implying regional enforcement?
3. **Navigation arrow:** Does the breadcrumb *Mukunguhati wa swibyariwa → Tiko ra ndhawu na xifundzha* fit comfortably on smaller phone viewports?

### Tshivenda (`ve`)
1. **Virtual bed:** Does *mbethe wa maitele* clearly distinguish an unmapped growing bed from sleeping furniture?
2. **Country confirmation:** Does *U khwathisedza shango a zwi tendeli nyeletshedzo dza vhulimi dza vhupo vhuswa* clearly communicate that confirming a country does not automatically approve local agricultural advice?
3. **Nursery tools:** Is *zwishumiswa zwa nese* appropriate for seedling propagation equipment?

---

## 3. Required Human Verification Checks

Before these AI drafts can be treated as fluent-reviewed or approved language content:
- [ ] **Bed vs. Furniture:** Confirm cultivated planting beds are never translated as domestic furniture.
- [ ] **Country vs. Local Advice:** Confirm country description confirmation is strictly separated from local agronomic advice approval.
- [ ] **Workspace Scope:** Confirm that reference-basis choices remain tied to the specific workspace.
- [ ] **Navigation Formatting:** Verify that the navigation arrow `→` is preserved verbatim.
- [ ] **Reviewer Sign-off:** Record the named fluent reviewer, date, dialect, and feedback before treating these as approved language content. The branch includes them only through the existing disclosed unreviewed candidate mechanism; this is not new-language enablement or fluent approval.
