import {
  CORE_FIELD_CYCLES, ELECTIVE_FIELD_PATHWAYS, FIELDWORK_SOURCES,
  fieldworkForLesson, type FieldCycle,
} from '@/lib/course-fieldwork';
import { LESSON_INDEX } from '@/lib/course-modules';

const ink = '#3A3020';

function Cycle({ cycle, showReadings = false }: { cycle: FieldCycle; showReadings?: boolean }) {
  return (
    <details className="rounded-xl border p-4" style={{ borderColor: '#E2D8C4', background: '#FFFEFA' }}>
      <summary className="cursor-pointer font-semibold leading-relaxed" style={{ color: '#1F4D2B', minHeight: 44 }}>
        {cycle.week ? `Week ${cycle.week} · ` : ''}{cycle.title}
      </summary>
      <div className="space-y-4 pt-3 text-sm leading-relaxed" style={{ color: ink }}>
        <p><strong>Why this matters. </strong>{cycle.why}</p>
        <p><strong>Look closely. </strong>{cycle.see}</p>
        <div>
          <p className="font-semibold mb-2">Try it in the field</p>
          <ol className="list-decimal pl-5 space-y-2">
            {cycle.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
        <p><strong>Keep a record. </strong>{cycle.record}</p>
        <p><strong>Think it through. </strong>{cycle.reflect}</p>
        <p className="rounded-lg p-3" style={{ background: '#F2EBDD' }}><strong>Discuss with your facilitator. </strong>{cycle.mentorCheck}</p>
        <p><strong>If the timing is wrong. </strong>{cycle.whenBlocked}</p>
        {showReadings && (
          <div>
            <p className="font-semibold mb-1">Read alongside this activity</p>
            <ul className="list-disc pl-5 space-y-1">
              {cycle.lessonIds.map((id) => {
                const entry = LESSON_INDEX.get(id);
                return entry ? <li key={id}>{entry.lesson.title}</li> : null;
              })}
            </ul>
            <p className="mt-2">Find these readings in the modules below as you work through the course.</p>
          </div>
        )}
        {(cycle.sourceIds ?? []).map((id) => {
          const source = FIELDWORK_SOURCES[id as keyof typeof FIELDWORK_SOURCES];
          return source ? <a key={id} className="block underline py-2" href={source.url} target="_blank" rel="noopener noreferrer">{source.title} (opens online)</a> : null;
        })}
      </div>
    </details>
  );
}

/** The same authored activity appears in the full programme and alongside its related reading.
 * It carries no completion checkbox: field evidence still goes through the existing assessment.
 */
export function LessonFieldwork({ lessonId }: { lessonId: string }) {
  const cycles = fieldworkForLesson(lessonId);
  if (cycles.length === 0) return null;
  return (
    <section aria-label="Practise this lesson" className="space-y-3" lang="en">
      <h3 className="font-semibold" style={{ color: '#1F4D2B' }}>Practise this lesson</h3>
      <p className="text-sm leading-relaxed" style={{ color: ink }}>English field activities. Choose the activity that fits your current crop and stage of learning. Discuss it in your preferred language with your facilitator.</p>
      {cycles.map((cycle) => <Cycle key={cycle.id} cycle={cycle} />)}
    </section>
  );
}

export default function FieldCourse() {
  return (
    <details className="rounded-2xl border p-4" style={{ background: '#F8F3E8', borderColor: '#D4C6A9' }} lang="en">
      <summary className="cursor-pointer font-semibold leading-relaxed" style={{ color: '#1F4D2B', minHeight: 44 }}>
        Your field programme · 36 weeks and four pathways
      </summary>
      <div className="space-y-4 pt-3">
        <p className="text-sm leading-relaxed" style={{ color: ink }}>Move from reading to doing: observe, practise, keep a record and discuss what you learned. These English activities extend the lessons below. IsiZulu versions and narrated demonstrations for the expanded programme are still being prepared.</p>
        <p className="text-sm leading-relaxed" style={{ color: ink }}>The weeks show a learning sequence. Your facilitator will adjust field work to local weather, water and crop stage. Keep notes on paper or in your field journal. Use the existing module assignment to submit evidence when requested.</p>
        {CORE_FIELD_CYCLES.map((cycle) => <Cycle key={cycle.id} cycle={cycle} showReadings />)}
        <h3 className="font-semibold pt-2" style={{ color: '#1F4D2B' }}>Choose a pathway with your facilitator</h3>
        <p className="text-sm leading-relaxed" style={{ color: ink }}>These optional pathways deepen a particular interest alongside the core programme.</p>
        {ELECTIVE_FIELD_PATHWAYS.map((pathway) => (
          <details key={pathway.id} className="rounded-xl border p-4" style={{ borderColor: '#D4C6A9' }}>
            <summary className="cursor-pointer font-semibold" style={{ minHeight: 44, color: '#1F4D2B' }}>{pathway.title}</summary>
            <p className="text-sm leading-relaxed my-3" style={{ color: ink }}>{pathway.purpose}</p>
            <div className="space-y-3">{pathway.cycles.map((cycle) => <Cycle key={cycle.id} cycle={cycle} showReadings />)}</div>
          </details>
        ))}
      </div>
    </details>
  );
}
