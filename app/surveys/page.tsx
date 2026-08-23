'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, Plus, Check, Send, ChevronDown, ChevronUp, Loader2, X,
} from 'lucide-react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import {
  createSurvey,
  listSurveys,
  addSurveyResponse,
  listSurveyResponses,
  myRespondedSurveyIds,
} from '@/lib/db/queries';
import type { Survey, SurveyQuestion, SurveyQType } from '@/lib/db/types';

// ─── Sample data (shown when backend is not configured) ──────────────────────

const SAMPLE_SURVEYS: Survey[] = [
  {
    id: 'sample-1',
    org_name: 'Siyazama Trust',
    title: 'Mid-season check-in',
    questions: [
      { id: 'sq1', text: 'Have you harvested yet this season?', type: 'yesno', options: [] },
      { id: 'sq2', text: 'Roughly how much did you sell?', type: 'choice', options: ['Nothing yet', 'Under R500', 'R500–2000', 'Over R2000'] },
    ],
    created_by: 'sample',
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'sample-2',
    org_name: 'GreenRoots SA',
    title: 'Water access survey',
    questions: [
      { id: 'sq3', text: 'Do you have reliable water access at your plot?', type: 'yesno', options: [] },
      { id: 'sq4', text: 'What is your main water source?', type: 'choice', options: ['Municipal', 'Borehole', 'Rain tank', 'River / stream'] },
      { id: 'sq5', text: 'Any water challenges you want to tell us about?', type: 'text', options: [] },
    ],
    created_by: 'sample',
    created_at: '2026-06-10T00:00:00Z',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQuestionId(i: number) {
  return `q${Date.now()}${i}`;
}

const STAFF_ROLES = new Set(['ngo', 'funder', 'admin']);

// ─── Staff: survey builder ────────────────────────────────────────────────────

interface DraftQuestion {
  _key: string;
  text: string;
  type: SurveyQType;
  options: string[];
}

function QuestionBuilder({
  q,
  onChange,
  onRemove,
}: {
  q: DraftQuestion;
  onChange: (updated: DraftQuestion) => void;
  onRemove: () => void;
}) {
  function setType(t: SurveyQType) {
    onChange({ ...q, type: t, options: t === 'choice' ? ['', ''] : [] });
  }
  function setOption(idx: number, val: string) {
    const opts = [...q.options];
    opts[idx] = val;
    onChange({ ...q, options: opts });
  }
  function addOption() {
    if (q.options.length >= 4) return;
    onChange({ ...q, options: [...q.options, ''] });
  }
  function removeOption(idx: number) {
    if (q.options.length <= 2) return;
    onChange({ ...q, options: q.options.filter((_, i) => i !== idx) });
  }

  const TYPE_OPTS: { v: SurveyQType; label: string }[] = [
    { v: 'yesno', label: 'Yes / No' },
    { v: 'choice', label: 'Multiple choice' },
    { v: 'text', label: 'Short text' },
  ];

  return (
    <div className="rounded-2xl p-3.5 space-y-2.5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="flex gap-2 items-start">
        <input
          value={q.text}
          onChange={(e) => onChange({ ...q, text: e.target.value })}
          placeholder="Question text..."
          className="flex-1 font-sans text-sm rounded-xl px-3 py-2 outline-none"
          style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}
        />
        <button
          onClick={onRemove}
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(32,25,15,0.05)', border: '1px solid #E2D8C4', color: '#8C7A62', cursor: 'pointer' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Type selector */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_OPTS.map(({ v, label }) => {
          const on = q.type === v;
          return (
            <button
              key={v}
              onClick={() => setType(v)}
              className="px-2.5 py-1 rounded-full font-display text-xs font-semibold"
              style={{
                background: on ? '#1F4D2B' : 'rgba(31,77,43,0.07)',
                color: on ? '#EAF3E2' : '#1F4D2B',
                border: `1px solid ${on ? '#1F4D2B' : 'rgba(31,77,43,0.2)'}`,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Choice options */}
      {q.type === 'choice' && (
        <div className="space-y-1.5">
          {q.options.map((opt, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <div className="flex-shrink-0 w-4 h-4 rounded-full" style={{ background: 'rgba(192,122,30,0.15)', border: '1px solid rgba(192,122,30,0.35)' }} />
              <input
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 font-sans text-xs rounded-lg px-2.5 py-1.5 outline-none"
                style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}
              />
              {q.options.length > 2 && (
                <button onClick={() => removeOption(i)} style={{ color: '#8C7A62', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          {q.options.length < 4 && (
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 text-xs font-display font-semibold"
              style={{ color: '#C07A1E', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
            >
              <Plus size={12} /> Add option
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SurveyBuilder({ isLive, onCreated }: { isLive: boolean; onCreated: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [orgName, setOrgName] = useState(profile?.full_name ?? '');
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { _key: 'init0', text: '', type: 'yesno', options: [] },
  ]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sampleNote, setSampleNote] = useState(false);

  function addQuestion() {
    const idx = questions.length;
    setQuestions((prev) => [...prev, { _key: makeQuestionId(idx), text: '', type: 'yesno', options: [] }]);
  }
  function updateQuestion(i: number, updated: DraftQuestion) {
    setQuestions((prev) => prev.map((q, j) => (j === i ? updated : q)));
  }
  function removeQuestion(i: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, j) => j !== i));
  }

  async function handleSend() {
    if (!title.trim() || !orgName.trim()) return;
    const validQs = questions.filter((q) => q.text.trim());
    if (validQs.length === 0) return;

    if (!isLive) {
      setSampleNote(true);
      setTimeout(() => setSampleNote(false), 3000);
      return;
    }

    setSaving(true);
    const finalQs: SurveyQuestion[] = validQs.map((q, i) => ({
      id: makeQuestionId(i),
      text: q.text.trim(),
      type: q.type,
      options: q.type === 'choice' ? q.options.filter((o) => o.trim()) : [],
    }));
    await createSurvey({ org_name: orgName.trim(), title: title.trim(), questions: finalQs });
    setSaving(false);
    setSaved(true);
    setTitle('');
    setOrgName(profile?.full_name ?? '');
    setQuestions([{ _key: makeQuestionId(0), text: '', type: 'yesno', options: [] }]);
    setTimeout(() => { setSaved(false); setOpen(false); onCreated(); }, 1800);
  }

  const canSend = title.trim() && orgName.trim() && questions.some((q) => q.text.trim());

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 34, height: 34, background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.25)' }}>
          <Plus size={16} style={{ color: '#C07A1E' }} strokeWidth={1.8} />
        </div>
        <span className="flex-1 font-display font-semibold text-sm" style={{ color: '#20190F' }}>New survey</span>
        {open
          ? <ChevronUp size={15} style={{ color: '#8C7A62' }} />
          : <ChevronDown size={15} style={{ color: '#8C7A62' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #E2D8C4' }}>
          <div className="pt-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Survey title..."
              className="w-full font-display font-semibold text-sm rounded-xl px-3 py-2.5 outline-none"
              style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}
            />
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organisation name..."
              className="w-full font-sans text-sm rounded-xl px-3 py-2 outline-none"
              style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}
            />
          </div>

          <div className="text-xs font-sans uppercase tracking-wider" style={{ color: '#8C7A62', letterSpacing: '0.08em' }}>
            Questions
          </div>

          <div className="space-y-2.5">
            {questions.map((q, i) => (
              <QuestionBuilder
                key={q._key}
                q={q}
                onChange={(updated) => updateQuestion(i, updated)}
                onRemove={() => removeQuestion(i)}
              />
            ))}
          </div>

          <button
            onClick={addQuestion}
            className="flex items-center gap-2 font-display text-sm font-semibold"
            style={{ color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Plus size={14} strokeWidth={1.8} /> Add question
          </button>

          {sampleNote && (
            <p className="text-xs font-sans rounded-xl px-3 py-2" style={{ background: 'rgba(192,122,30,0.09)', color: '#C07A1E', border: '1px solid rgba(192,122,30,0.2)' }}>
              Sample mode — connect Firebase to save surveys live.
            </p>
          )}

          <button
            onClick={handleSend}
            disabled={!canSend || saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-semibold text-sm"
            style={{
              background: canSend && !saving ? '#C07A1E' : 'rgba(192,122,30,0.35)',
              color: '#fff',
              border: 'none',
              cursor: canSend && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : saved
                ? <Check size={14} />
                : <Send size={14} strokeWidth={1.8} />}
            {saving ? 'Sending...' : saved ? 'Survey sent!' : 'Send survey'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Staff: existing survey card ──────────────────────────────────────────────

function StaffSurveyCard({ survey, isLive }: { survey: Survey; isLive: boolean }) {
  const [responseCount, setResponseCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isLive) { setResponseCount(Math.floor(Math.random() * 12)); return; }
    listSurveyResponses(survey.id).then((rs) => setResponseCount(rs.length));
  }, [survey.id, isLive]);

  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm truncate" style={{ color: '#20190F' }}>{survey.title}</div>
          <div className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>
            {survey.org_name} &middot; {survey.questions.length} question{survey.questions.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.18)' }}>
          <ClipboardList size={11} style={{ color: '#1F4D2B' }} strokeWidth={1.8} />
          <span className="font-display font-semibold text-xs" style={{ color: '#1F4D2B' }}>
            {responseCount === null ? '—' : responseCount} response{responseCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Farmer: answer flow ──────────────────────────────────────────────────────

function FarmerSurveyCard({
  survey,
  answered,
  isLive,
  onAnswered,
}: {
  survey: Survey;
  answered: boolean;
  isLive: boolean;
  onAnswered: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(answered);

  function setAnswer(qid: string, val: string) {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
  }

  const allAnswered = survey.questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== '');

  async function handleSubmit() {
    if (!allAnswered) return;
    setSubmitting(true);
    if (isLive) {
      await addSurveyResponse(survey.id, answers);
    }
    setSubmitting(false);
    setSubmitted(true);
    setOpen(false);
    onAnswered(survey.id);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <button
        onClick={() => { if (!submitted) setOpen((o) => !o); }}
        disabled={submitted}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: submitted ? 'default' : 'pointer' }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm truncate" style={{ color: '#20190F' }}>{survey.title}</div>
          <div className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>
            From {survey.org_name} &middot; {survey.questions.length} question{survey.questions.length !== 1 ? 's' : ''}
          </div>
        </div>
        {submitted ? (
          <div className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.25)' }}>
            <Check size={12} style={{ color: '#1F4D2B' }} strokeWidth={2} />
            <span className="font-display font-semibold text-xs" style={{ color: '#1F4D2B' }}>Answered</span>
          </div>
        ) : open ? (
          <ChevronUp size={15} style={{ color: '#8C7A62', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={15} style={{ color: '#8C7A62', flexShrink: 0 }} />
        )}
      </button>

      {open && !submitted && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid #E2D8C4' }}>
          {survey.questions.map((q) => (
            <div key={q.id} className="pt-3 space-y-2">
              <div className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>{q.text}</div>

              {q.type === 'yesno' && (
                <div className="flex gap-2">
                  {['Yes', 'No'].map((v) => {
                    const on = answers[q.id] === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setAnswer(q.id, v)}
                        className="flex-1 py-2.5 rounded-xl font-display font-semibold text-sm"
                        style={{
                          background: on ? '#1F4D2B' : '#fff',
                          color: on ? '#EAF3E2' : '#20190F',
                          border: `1px solid ${on ? '#1F4D2B' : '#D8CBB2'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'choice' && (
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const on = answers[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setAnswer(q.id, opt)}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left"
                        style={{
                          background: on ? 'rgba(31,77,43,0.08)' : '#fff',
                          border: `1px solid ${on ? '#1F4D2B' : '#D8CBB2'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div className="flex items-center justify-center rounded-full flex-shrink-0"
                          style={{ width: 18, height: 18, border: `1.5px solid ${on ? '#1F4D2B' : '#C9BBA1'}`, background: on ? '#1F4D2B' : 'transparent' }}>
                          {on && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EAF3E2' }} />}
                        </div>
                        <span className="font-sans text-sm" style={{ color: '#20190F' }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Your answer..."
                  rows={3}
                  className="w-full font-sans text-sm rounded-xl px-3 py-2.5 outline-none resize-none"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}
                />
              )}
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-semibold text-sm mt-2"
            style={{
              background: allAnswered && !submitting ? '#C07A1E' : 'rgba(192,122,30,0.35)',
              color: '#fff',
              border: 'none',
              cursor: allAnswered && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={1.8} />}
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurveysPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const isStaff = role !== null && STAFF_ROLES.has(role);

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user && isLive) router.replace('/login');
  }, [user, loading, router, isLive]);

  const load = useCallback(async () => {
    setFetching(true);
    if (isLive) {
      const [list, responded] = await Promise.all([
        listSurveys(),
        myRespondedSurveyIds(),
      ]);
      setSurveys(list);
      setRespondedIds(new Set(responded));
    } else {
      setSurveys(SAMPLE_SURVEYS);
      setRespondedIds(new Set());
    }
    setFetching(false);
  }, [isLive]);

  useEffect(() => { load(); }, [load]);

  function markAnswered(id: string) {
    setRespondedIds((prev) => new Set([...prev, id]));
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center px-4 gap-3"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Surveys</span>
        <div className="flex-1" />
        <LessonLink id="surveys:overview" label="Learn" />
        <SettingsButton />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 80 }}>

        {/* Section heading */}
        <div className="flex items-center gap-2.5">
          <ClipboardList size={16} style={{ color: '#1F4D2B' }} strokeWidth={1.7} />
          <h1 className="font-display font-bold text-lg leading-tight" style={{ color: '#20190F', letterSpacing: '-0.01em' }}>
            {isStaff ? 'Survey builder' : 'Available surveys'}
          </h1>
        </div>

        {/* Staff view */}
        {isStaff && (
          <>
            <SurveyBuilder isLive={isLive} onCreated={load} />

            {fetching ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} className="animate-spin" style={{ color: '#1F4D2B' }} />
              </div>
            ) : surveys.length === 0 ? (
              <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <ClipboardList size={26} style={{ color: '#8C7A62', margin: '0 auto 8px' }} strokeWidth={1.5} />
                <p className="font-display text-sm" style={{ color: '#5C5040' }}>
                  No surveys yet. Build the first one above.
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs font-sans uppercase tracking-wider" style={{ color: '#8C7A62', letterSpacing: '0.08em' }}>
                  Existing surveys
                </div>
                <div className="space-y-3">
                  {surveys.map((s) => (
                    <StaffSurveyCard key={s.id} survey={s} isLive={isLive} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Farmer / other view */}
        {!isStaff && (
          <>
            {fetching ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} className="animate-spin" style={{ color: '#1F4D2B' }} />
              </div>
            ) : surveys.length === 0 ? (
              <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <ClipboardList size={26} style={{ color: '#8C7A62', margin: '0 auto 8px' }} strokeWidth={1.5} />
                <p className="font-display text-sm" style={{ color: '#5C5040' }}>
                  No surveys available right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {surveys.map((s) => (
                  <FarmerSurveyCard
                    key={s.id}
                    survey={s}
                    answered={respondedIds.has(s.id)}
                    isLive={isLive}
                    onAnswered={markAnswered}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!isLive && (
          <p className="text-center text-xs font-sans" style={{ color: '#8C7A62' }}>
            Sample data — connect Firebase to go live
          </p>
        )}
      </main>

      <TabBar />
    </div>
  );
}
