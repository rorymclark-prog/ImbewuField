import { Droplets, Sprout, ShoppingBasket, GraduationCap } from 'lucide-react';
import Illustration from './Illustration';
import styles from './FieldWork.module.css';

export default function FieldVisitGuide({ actProgramme }: { actProgramme: boolean }) {
  return <>
    <h2>{actProgramme ? 'Food-security visit guide' : 'A useful garden visit'}</h2>
    <div className={styles.guideLandscape}><Illustration name="example-hero"/></div>
    <p>Walk the garden together. Look, ask and practise.</p>
    <ol className={styles.guide}>
      {[
        { title: 'Garden & water', detail: 'Check beds, water access, repairs and crop protection.', Icon: Droplets, tone: '#e5f0f5', ink: '#245f78' },
        { title: 'Soil & seedlings', detail: 'Look at soil cover, compost, seedlings and the next planting.', Icon: Sprout, tone: '#edf2df', ink: '#466326' },
        { title: 'Harvest & food access', detail: 'Separate what is eaten or shared, sold and stored.', Icon: ShoppingBasket, tone: '#fbefdb', ink: '#845614' },
        { title: 'Learning & next action', detail: 'Watch a practical skill. Agree an action, owner and date.', Icon: GraduationCap, tone: '#eeeaf5', ink: '#62507b' },
      ].map(({ title, detail, Icon, tone, ink }, index) => <li key={title}>
        <span className={styles.guideIcon} style={{ background: tone, color: ink }} aria-hidden="true"><Icon size={32} strokeWidth={1.65}/></span>
        <div><strong><span className={styles.stepNumber}>{index + 1}</span>{title}</strong><p>{detail}</p></div>
      </li>)}
    </ol>
    <details className={styles.guideNote}><summary>How these records support the programme</summary><p>{actProgramme ? 'These records support ACT’s SEF food-security delivery. Employment attendance and payroll remain in the approved SEF process.' : 'Training attendance and observed practical skills are recorded separately.'}</p></details>
  </>;
}
