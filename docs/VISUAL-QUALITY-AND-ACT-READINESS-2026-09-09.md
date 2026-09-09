# Mentor visual quality and ACT reporting readiness — 9 September 2026

Rory's latest requirement makes profile photographs and useful graphics a normal
part of the experience. The mentor priorities screen had portraits available but
did not use them, and its visit guide was a tall text-only panel.

## Changes

- A shared avatar shows the correct existing profile photo, including live profiles;
  missing or failed images use initials. Learning-card portraits do not create a
  second button inside the expand button. Fieldwork portraits can open larger.
- Priorities, people, visits and mentor-team cards share that identity treatment.
- The guide reuses the app's landscape illustration with four illustrated prompts.
  Secondary programme context is expandable. Panels no longer stretch to empty height.
- Coverage displays the same scoped, distinct participant counts as the report.
  It never represents yield, skill achievement or distinct garden sites.

## Evidence for the design direction

- [Mayer, Multimedia Principle](https://www.cambridge.org/core/books/multimedia-learning/multimedia-principle/1CC3DE892B0431BA48B4C4DCA10D0B8F): the chapter reports better transfer performance with words and relevant pictures in 11 of 11 tests. These are learning experiments, not a population survey of app preferences.
- [NN/g photo eye-tracking](https://www.nngroup.com/articles/photos-as-web-content/): participants attended to relevant real-person/product images; purely decorative photographs were often ignored.
- [Tuch et al., 2012](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/): two experiments found visual complexity and familiarity affected aesthetic judgments; simpler familiar layouts were more appealing. This supports clear visual hierarchy, not unlimited image density.
- [SEF's 2025 learning brief, p.13](https://www.socialemploymentfund.co.za/wp-content/uploads/2025/09/Social-Employment-Fund_Learning-Brief_Food-Security-and-Nutrition-1.pdf): ACT describes learning across teams through shared photographs of fieldwork.

These sources support the design direction. They do not establish a percentage of
all people who prefer graphics, or prove improved engagement among ACT mentors.
Test that with representative mentors completing a visit, finding an overdue
action and interpreting a report; compare errors, completion and enjoyment.

## ACT reporting map

Based on [ACT's food-security programme](https://projectafrica.com/food-security/)
and [published SEF activities and historical outputs](https://projectafrica.com/social-employment-fund/).
These are public programme priorities, not the current contractual reporting form.

| Public priority | Available capture/report route | Qualification |
| --- | --- | --- |
| Productive gardens and area | Garden/site register; gardens, vegetable and staple area indicators | Deduplicate sites; confirm whether ACT wants established, maintained or producing area and the reporting unit. |
| Food supplied to communities | New optional produce-donated indicator, kg | Donation excludes household retention. It is a subset of food use, never an extra harvest. |
| Demonstration gardens and nurseries | New optional demonstration-garden and seedling-dispatch indicators | Require site checks or dated dispatch records; no targets or results prefilled. |
| Agroecology training | Session registers, signatures, feedback, new course-completion indicator, separate skills indicator | Agree course completion criteria; attendance, certificates and observed skills remain distinct. |
| Erosion control and invasive management | Restoration-area indicator; new invasive-management area indicator | Document work footprints and repeat treatments; activity does not demonstrate recovery. |
| Mentorship and practical support | Visits, support areas, owner/date, completion evidence, photographs | Internal notes remain internal; funders receive the published programme view. |
| Employment participation and payments | Existing paid-work indicator can reference approved external registers | No integration with SEF attendance/payroll is claimed. |

ACT still needs to supply or approve its current indicator dictionary, targets,
reporting periods, required evidence, course completion rules, reporting template
and sign-off roles. Public historical figures are not imported into a live project.

## Verification boundaries

The location tests mount the real React control and stub only the device API.
They exercise explicit capture, fresh readings, accuracy messages, permission
denial, timeout, invalid coordinates, removal/unmount races and tour isolation.
They do not test physical GPS reception or Safari permission behaviour.

The available browser has no phone viewport or GPS-emulation capability. The
responsive CSS is reviewed, and desktop browser output must be inspected before
release; neither is described as a real-phone test. A physical-device check must
still exercise portrait layout, keyboard, location allow/deny, map destination,
save/reopen and accuracy at an actual venue. No signed-in client records are used.
