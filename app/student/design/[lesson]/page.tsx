import { notFound } from 'next/navigation';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import FinanceText from '@/components/studies/FinanceText';
import { DESIGN_COURSE, DESIGN_LESSONS, DESIGN_GUIDE_NAMES, designLesson } from '@/lib/course-design';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import DesignDraftCopy, { DesignDraftNotice } from '@/components/studies/DesignDraftCopy';
import FullToolsOnly from '@/components/studies/FullToolsOnly';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Permaculture design lesson — teaching preview', robots: { index: false, follow: false } };
export function generateStaticParams() { return DESIGN_LESSONS.map(({ lesson }) => ({ lesson: lesson.id })); }

export default async function DesignLessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: id } = await params;
  const entry = designLesson(id);
  if (!entry) notFound();
  const { unit, lesson } = entry;
  const index = DESIGN_LESSONS.findIndex(item => item.lesson.id === id);
  const previous = DESIGN_LESSONS[index - 1]?.lesson;
  const next = DESIGN_LESSONS[index + 1]?.lesson;
  const section = (title: string) => lesson.sections.find(item => item.title === title)!.text;
  const [question, feedback] = section('Check').split('**Answer:**');
  const companion = lesson.sections.filter(item => item.title.startsWith('App companion'));
  const workedStage = {
    d1: ['read', 'Read the supplied brief and source map'],
    d2: ['map', 'Read the reported influences and their limits'],
    d3: ['compare', 'Compare the two provisional concepts'],
    d4: ['develop', 'Inspect dimensions and the provisional choice'],
    d5: ['work', 'Trace work, cost and care dependencies'],
    d6: ['revision', 'Review the later evidence and revision'],
  }[unit.id];
  const workedStageZu = {
    d1: 'Funda incazelo enikeziwe nemephu yomthombo', d2: 'Funda imithelela ebikiwe nemikhawulo yayo',
    d3: 'Qhathanisa imiqondo emibili yesikhashana', d4: 'Hlola ubukhulu nokukhetha kwesikhashana',
    d5: 'Landela ukuncika komsebenzi, izindleko nokunakekela', d6: 'Buyekeza ubufakazi bakamuva noshintsho',
  }[unit.id];
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/design" /><OfflinePageLink href="/student/design"><DesignDraftCopy en="Design a homestead" zu="Dizayina ikhaya" /></OfflinePageLink><span data-header-secondary>{lesson.code} · {index + 1} / {DESIGN_LESSONS.length}</span></header>
    <main className={styles.main}>
      <DesignDraftNotice />
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}><DesignDraftCopy en={`Stage ${unit.number}`} zu={`Isigaba ${unit.number}`} /> · {unit.title}</p><h1>{lesson.title}</h1><p>{section('Question to show')}</p><div className={styles.actions}><a href="#read"><DesignDraftCopy en="Read the idea" zu="Funda umqondo" /></a><a href="#practice"><DesignDraftCopy en="Try the task" zu="Zama umsebenzi" /></a><a href="#check"><DesignDraftCopy en="Check your understanding" zu="Hlola ukuqonda kwakho" /></a></div></div></section>
      <aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong>English teaching preview.</strong> Use a notebook, drawings or supported spoken answers. The supplied fictional worked demonstration supports the lesson method; a real field plan still needs checked measurements, evidence and review. These pages do not certify a design or award assessed progress. Audio and translations are not yet available; save the pathway from its overview before leaving signal.</p></aside>
      <section className={`${styles.section} ${styles.reading}`} id="read"><h2><DesignDraftCopy en="The idea" zu="Umqondo" /></h2><FinanceText text={section('Teaching text')} /></section>
      <section className={styles.section}><p className={styles.eyebrow}><DesignDraftCopy en="The busy yard · invented classroom example" zu="Igceke elimatasa · isibonelo sekilasi esiqanjiwe" /></p><h2><DesignDraftCopy en="Follow the decision" zu="Landela isinqumo" /></h2><FinanceText text={section('Worked example')} /><div className={styles.actions}><OfflinePageLink href="/student/design/case"><DesignDraftCopy en="See the full case and source notes →" zu="Bona icala eligcwele namanothi emithombo →" /></OfflinePageLink></div></section>
      <section className={styles.section} id="practice"><h2><DesignDraftCopy en="Make the next part of your folder" zu="Qedela ingxenye elandelayo yefolda yakho" /></h2><FinanceText text={section('Learner task')} /><h3><DesignDraftCopy en="What your partner or facilitator should look for" zu="Okufanele kubhekwe uzakwenu noma umgqugquzeli" /></h3><FinanceText text={section('Evidence for feedback')} /><div className={styles.actions}><OfflinePageLink href={`/student/design/folder#folder-${unit.id}`}><DesignDraftCopy en="Record this stage in your design folder →" zu="Rekhoda lesi sigaba kufolda yakho yokuklama →" /></OfflinePageLink></div></section>
      {workedStage && <section className={styles.section}><p className={styles.eyebrow}><DesignDraftCopy en="Guided fictional model" zu="Imodeli eqanjiwe eqondiswayo" /></p><h2><DesignDraftCopy en="See this stage in a complete decision chain" zu="Bona lesi sigaba ochungechungeni lwezinqumo oluphelele" /></h2><p>The worked demonstration uses supplied classroom geometry and a named source pack. It is separate from the unmeasured busy-yard exercise.</p><div className={styles.actions}><OfflinePageLink href={`/student/design/worked#${workedStage[0]}`}><DesignDraftCopy en={`${workedStage[1]} →`} zu={`${workedStageZu} →`} /></OfflinePageLink></div></section>}
      {['d1-3', 'd4-1', 'd4-3'].includes(id) && <section className={styles.section}><p className={styles.eyebrow}><DesignDraftCopy en="Visual practice · supplied model dimensions" zu="Ukuzilolonga ngokubona · izilinganiso zemodeli enikeziwe" /></p><h2><DesignDraftCopy en="Read the scale and check the space" zu="Funda isikali bese uhlola isikhala" /></h2><p>Compare two bed outlines with a gap, touching edges and an overlap. Follow the supplied dimensions and check what the area total counts. This is a separate sample-model exercise, not a measurement of the busy-yard household.</p><div className={styles.actions}><OfflinePageLink className={styles.primary} href="/student/design/scale"><DesignDraftCopy en="Open the scale exercise →" zu="Vula umsebenzi wesikali →" /></OfflinePageLink></div></section>}
      <section className={styles.section} id="check"><h2><DesignDraftCopy en="Pause and explain" zu="Yima uchaze" /></h2><FinanceText text={question} /><p><DesignDraftCopy en="Try your own explanation before opening the discussion answer." zu="Zama ukuchaza ngawakho amazwi ngaphambi kokuvula impendulo yengxoxo." /></p><details><summary><DesignDraftCopy en="Compare your reasoning" zu="Qhathanisa indlela ocabange ngayo" /></summary><FinanceText text={feedback} /></details></section>
      <section className={styles.section}><h2><DesignDraftCopy en="Use the app alongside this lesson" zu="Sebenzisa uhlelo lokusebenza kanye nalesi sifundo" /></h2><p>Practise in the sample farm first. Keep the source map and its measurements when trying a proposal. A paper design folder is also valid.</p>{companion.map(item => <FinanceText key={item.title} text={item.text} />)}<div className={styles.actions}>{unit.guides.map(id => <OfflinePageLink key={id} href={`/student/guides/${id}`}>{DESIGN_GUIDE_NAMES[id]} →</OfflinePageLink>)}{unit.id === 'd5' && <OfflinePageLink href="/student/finance">Farm Finance course →</OfflinePageLink>}</div></section>
      <section className={styles.section}><FullToolsOnly><details><summary>Sources and further reading</summary><p>Drawn from Rory’s course outlines, handbook and RVCC planning material, with the design framework checked against these primary references.</p><ul>{DESIGN_COURSE.sources.map(source => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul></details></FullToolsOnly><nav aria-label="Design lesson navigation" className={styles.actions}>{previous && <OfflinePageLink href={`/student/design/${previous.id}`}>← {previous.title}</OfflinePageLink>}{next ? <OfflinePageLink className={styles.primary} href={`/student/design/${next.id}`}>Next: {next.title} →</OfflinePageLink> : <OfflinePageLink className={styles.primary} href="/student/design">Return to the pathway</OfflinePageLink>}</nav></section>
    </main>
  </div>;
}
