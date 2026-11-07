import { ChevronDown } from 'lucide-react';
import EnglishOnly from '@/components/studies/EnglishOnly';
import { DESIGN_COURSE, DESIGN_LESSONS } from '@/lib/course-design';
import PathwayOfflineDownload from '@/components/studies/PathwayOfflineDownload';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import DesignDraftCopy, { DesignDraftNotice } from '@/components/studies/DesignDraftCopy';
import CourseSyllabus from '@/components/studies/CourseSyllabus';
import FullToolsOnly from '@/components/studies/FullToolsOnly';
import styles from '@/components/studies/FinanceCourse.module.css';
import ArrowLabel from '@/components/studies/ArrowLabel';
import StudyHeader from '@/components/studies/StudyHeader';
import Summary from '@/components/studies/Summary';
import Tx, { TxImg } from '@/components/studies/Tx';

export const metadata = { title: 'Design a working homestead — teaching preview', robots: { index: false, follow: false } };

export default function DesignCoursePage() {
  return <div className={styles.page}>
    <StudyHeader title="Permaculture design" zuTitle="Ukudizayina ngendlela ye-permaculture" />
    <main className={styles.main}>
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}><DesignDraftCopy en="From observation to a working plan" zu="Ukusuka ekuqapheliseni uye ohlelweni olusebenzayo" /></p><h1><DesignDraftCopy en="Design for the people. Work with the place." zu="Dizayina ucabangela abantu. Sebenzisana nendawo." /></h1><p><DesignDraftCopy en="Bring water, soil, growing systems, access, care and money into one reasoned plan. Follow six stages, then explain and improve your decisions." zu="Hlanganisa amanzi, umhlabathi, izinhlelo zokutshala, indlela yokungena, ukunakekela nemali kube uhlelo olunezizathu. Landela izigaba eziyisithupha, bese uchaza futhi uthuthukise izinqumo zakho." /></p><div className={styles.actions}><OfflinePageLink className={styles.primary} href="/student/design/d1-1"><DesignDraftCopy en="Start with the household brief →" zu="Qala ngencazelo yezidingo zomuzi →" /></OfflinePageLink><OfflinePageLink href="/student/design/case"><DesignDraftCopy en="Meet the practice household" zu="Bona umuzi wesibonelo sokuzilolonga" /></OfflinePageLink></div></div><TxImg src="/studies-guides/sketch-the-site.jpg" alt="Illustrated growers discussing a paper plan beside a homestead garden; the drawing is illustrative, not surveyed" width={1672} height={941} /></section>
      <EnglishOnly><aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong><Tx en="English teaching preview · {n} lesson drafts." values={{ n: DESIGN_LESSONS.length }} /></strong> <Tx en="Reading these pages does not award course credit or certify a design." /></p><details><summary><Tx en="More" /><ChevronDown className={styles.chevron} size={20} aria-hidden="true" /></summary><p><Tx en="Read and practise with a facilitator or learning partner. A supplied fictional worked demonstration and scale exercise are available; a real field plan still needs its own checked measurements, evidence and review. Reviewed lesson translations and narration are not yet available. Some page labels may appear as unreviewed isiZulu drafts. Save the reading pathway for offline use here before leaving signal." /></p></details></aside></EnglishOnly>
      <DesignDraftNotice />
      <section className={styles.section}><h2><DesignDraftCopy en="Build one design folder as you learn" zu="Yakha ifolda eyodwa yokuklama njengoba ufunda" /></h2><p><Tx en="Keep your brief, observations, existing map, alternatives, chosen plan, work and care arrangements, and revisions together. Use paper, spoken explanations or the app. Each stage adds a reasoned decision, not just another feature on a drawing." /></p><p><Tx en="Use the existing technical modules when checking a water, soil, planting or animal proposal. This pathway teaches how to connect those decisions. A field plan still needs suitable measurements, local evidence and any relevant advice or permissions." /></p><div className={styles.actions}><OfflinePageLink className={styles.primary} href="/student/design/folder"><DesignDraftCopy en="Open your design learning folder →" zu="Vula ifolda yakho yokufunda ngokuklama →" /></OfflinePageLink></div></section>
      <CourseSyllabus
        units={DESIGN_COURSE.units.map(unit => ({ id: unit.id, number: unit.number, title: <Tx en={unit.title} />, blurb: <Tx en={unit.output} />, lessons: unit.lessons.map(lesson => ({ ...lesson, title: <Tx en={lesson.title} /> })) }))}
        basePath="/student/design"
        eyebrowPrefix={<Tx en="Stage" />}
        continueEyebrow={<DesignDraftCopy en="Continue here" zu="Qhubeka lapha" />}
        seeAllLabel={<DesignDraftCopy en="See all stages" zu="Bona zonke izigaba" />}
      />
      <section className={styles.section}><h2><DesignDraftCopy en="Two examples, with their limits visible" zu="Izibonelo ezimbili, kanye nemikhawulo yazo" /></h2><p><Tx en="The busy-yard example teaches what to observe before drawing. The worked demonstration is a separate fictional model with supplied coordinates, fair alternatives and a revision after later care evidence. Neither is a construction plan or a record of a real household." /></p><div className={styles.actions}><OfflinePageLink className={styles.primary} href="/student/design/worked"><DesignDraftCopy en="Follow the worked design demonstration →" zu="Landela ukuboniswa komklamo osebenzayo →" /></OfflinePageLink><OfflinePageLink href="/student/design/case"><DesignDraftCopy en="Read the early evidence case →" zu="Funda icala lobufakazi bokuqala →" /></OfflinePageLink><OfflinePageLink href="/student/design/scale"><DesignDraftCopy en="Read the scale and check the space →" zu="Funda ngesikali bese uhlola isikhala →" /></OfflinePageLink><OfflinePageLink href="/student/guides/design"><DesignDraftCopy en="Use the Design Studio guide →" zu="Sebenzisa umhlahlandlela we-Design Studio →" /></OfflinePageLink><OfflinePageLink href="/student/finance"><DesignDraftCopy en="Connect the plan to Farm Finance →" zu="Xhumanisa uhlelo ne-Farm Finance →" /></OfflinePageLink></div></section>
      <section className={styles.section}><h2><Tx en="Learning takes observation and practice" /></h2><p><Tx en="Work at a pace that allows field observation, discussion and another attempt after feedback. Eighteen reading pages do not establish a course duration or replace seasonal evidence. The facilitator reviews what you can explain and demonstrate." /></p><FullToolsOnly><details><Summary><Tx en="Sources behind the pathway" /></Summary><p><Tx en="The teaching sequence draws on Rory’s Imbewu course outlines, Southern African gardening handbook and RVCC training/garden planning material. Historical technical prescriptions have not been copied as universal instructions." /></p><ul>{DESIGN_COURSE.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul></details></FullToolsOnly></section>
      <PathwayOfflineDownload pathwayId="design" />
    </main>
  </div>;
}
