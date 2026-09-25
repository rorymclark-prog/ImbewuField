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
  updateSurveyIsiZuluLabels,
  listSurveys,
  addSurveyResponse,
  countSurveyResponses,
  myRespondedSurveyIds,
} from '@/lib/db/queries';
import type { Survey, SurveyQuestion, SurveyQType } from '@/lib/db/types';
import { useLanguage } from '@/lib/i18n';
import { APP_HEADER_STYLE } from '@/lib/app-header';

function localUi(en: string, zu: string, lang: string) {
  return lang === 'zu' ? zu : en;
}

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

// Only these built-in demonstration records have paired AI draft text. Live organization copy
// stays exactly as authored, and the English option strings remain the stored response values.
const SAMPLE_SURVEY_ZU_DRAFTS: Record<string, { title?: string; questions?: Record<string, string>; options?: Record<string, string> }> = {
  'sample-1': {
    title: 'Ukuhlola phakathi nesizini',
    questions: {
      sq1: 'Ingabe usuvunile kule sizini?',
      sq2: 'Udayise cishe ngokungakanani?',
    },
    options: {
      'Nothing yet': 'Akukho okwamanje',
      'Under R500': 'Ngaphansi kuka-R500',
      'R500–2000': 'Phakathi kuka-R500 no-R2000',
      'Over R2000': 'Ngaphezulu kuka-R2000',
    },
  },
  'sample-2': {
    title: 'Ukuhlola ukutholakala kwamanzi',
    questions: {
      sq3: 'Ingabe unokuthola amanzi okuthembekile esivandeni sakho?',
      sq4: 'Yimuphi umthombo wakho omkhulu wamanzi?',
      sq5: 'Ingabe zikhona izinselelo zamanzi ofuna ukusitshela ngazo?',
    },
    options: {
      Municipal: 'Amanzi kamasipala',
      Borehole: 'I-borehole',
      'Rain tank': 'Ithangi lemvula',
      'River / stream': 'Umfula / umfudlana',
    },
  },
};

function showSampleDraft(survey: Survey, source: string, draft: string | undefined, lang: string) {
  return lang === 'zu' && survey.id.startsWith('sample-') && draft ? `${draft} / ${source}` : source;
}

function showSurveyLabel(source: string, zulu: string | undefined, lang: string) {
  return lang === 'zu' && zulu?.trim() ? `${zulu.trim()} / ${source}` : source;
}

function showSurveyText(survey: Survey, source: string, sampleDraft: string | undefined, zulu: string | undefined, lang: string) {
  const sampleText = showSampleDraft(survey, source, sampleDraft, lang);
  return sampleText === source ? showSurveyLabel(source, zulu, lang) : sampleText;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQuestionId(i: number) {
  return `q${Date.now()}${i}`;
}

const STAFF_ROLES = new Set(['ngo', 'admin']);
// Verified bug: surveys are answered by farmers and students (or a signed-out participant during
// the sample tour) — mentor and funder accounts are neither, but used to fall through to this
// same "answer this survey" flow as a farmer, with nothing stopping them submitting a response.
const ANSWER_ROLES = new Set(['farmer', 'student']);

// ─── Staff: survey builder ────────────────────────────────────────────────────

interface DraftQuestion {
  _key: string;
  text: string;
  text_zu: string;
  type: SurveyQType;
  options: string[];
  options_zu: string[];
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
  const { lang } = useLanguage();
  function setType(t: SurveyQType) {
    onChange({ ...q, type: t, options: t === 'choice' ? ['', ''] : [], options_zu: t === 'choice' ? ['', ''] : [] });
  }
  function setOption(idx: number, val: string) {
    const opts = [...q.options];
    opts[idx] = val;
    onChange({ ...q, options: opts });
  }
  function setOptionZu(idx: number, val: string) {
    const opts = [...q.options_zu];
    opts[idx] = val;
    onChange({ ...q, options_zu: opts });
  }
  function addOption() {
    if (q.options.length >= 4) return;
    onChange({ ...q, options: [...q.options, ''], options_zu: [...q.options_zu, ''] });
  }
  function removeOption(idx: number) {
    if (q.options.length <= 2) return;
    onChange({ ...q, options: q.options.filter((_, i) => i !== idx), options_zu: q.options_zu.filter((_, i) => i !== idx) });
  }

  const TYPE_OPTS: { v: SurveyQType; label: string }[] = [
    { v: 'yesno', label: localUi('Yes / No', 'Yebo / Cha', lang) },
    { v: 'choice', label: localUi('Multiple choice', 'Izimpendulo ongakhetha kuzo', lang) },
    { v: 'text', label: localUi('Short text', 'Umbhalo omfushane', lang) },
  ];

  return (
    <div className="rounded-2xl p-3.5 space-y-2.5" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div className="flex gap-2 items-start">
        <input
          value={q.text}
          onChange={(e) => onChange({ ...q, text: e.target.value })}
          placeholder={localUi('Question text...', 'Umbhalo wombuzo...', lang)}
          aria-label={localUi('Question text', 'Umbhalo wombuzo', lang)}
          className="flex-1 font-sans text-sm rounded-xl px-3 py-2 outline-none"
          style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
        />
        <button
          onClick={onRemove}
          className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 44, height: 44, background: 'rgba(32,25,15,0.05)', border: '1px solid var(--border)', color: '#755942', cursor: 'pointer' }}
          aria-label={localUi('Remove question', 'Susa umbuzo', lang)}
        >
          <X size={14} />
        </button>
      </div>

      {lang === 'zu' && (
        <input
          value={q.text_zu}
          onChange={(e) => onChange({ ...q, text_zu: e.target.value })}
          placeholder="Umbhalo wesiZulu (uyazikhethela)"
          aria-label="Umbhalo wesiZulu wombuzo (uyazikhethela)"
          className="w-full font-sans text-sm rounded-xl px-3 py-2 outline-none"
          style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
        />
      )}

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
                style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
              />
              {lang === 'zu' && (
                <input
                  value={q.options_zu[i] ?? ''}
                  onChange={(e) => setOptionZu(i, e.target.value)}
                  placeholder={`Impendulo ${i + 1} ngesiZulu (uyazikhethela)`}
                  aria-label={`Impendulo ${i + 1} ngesiZulu (uyazikhethela)`}
                  className="flex-1 font-sans text-xs rounded-lg px-2.5 py-1.5 outline-none"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
                />
              )}
              {q.options.length > 2 && (
                <button
                  onClick={() => removeOption(i)}
                  aria-label={localUi(`Remove option ${i + 1}`, `Susa impendulo ${i + 1}`, lang)}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 44, height: 44, color: '#755942', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          {q.options.length < 4 && (
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 text-xs font-display font-semibold"
              style={{ color: '#7A4408', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
            >
              <Plus size={12} /> {localUi('Add option', 'Engeza impendulo ongakhetha kuyo', lang)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SurveyBuilder({ isLive, onCreated }: { isLive: boolean; onCreated: () => void }) {
  const { lang } = useLanguage();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [titleZu, setTitleZu] = useState('');
  const [orgName, setOrgName] = useState(profile?.full_name ?? '');
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { _key: 'init0', text: '', text_zu: '', type: 'yesno', options: [], options_zu: [] },
  ]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sampleNote, setSampleNote] = useState(false);

  function addQuestion() {
    const idx = questions.length;
    setQuestions((prev) => [...prev, { _key: makeQuestionId(idx), text: '', text_zu: '', type: 'yesno', options: [], options_zu: [] }]);
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
      ...(q.text_zu.trim() ? { text_zu: q.text_zu.trim() } : {}),
      type: q.type,
      options: q.type === 'choice' ? q.options.flatMap((o) => o.trim() ? [o.trim()] : []) : [],
      ...(q.type === 'choice' && q.options.some((o) => o.trim())
        ? { options_zu: q.options.flatMap((o, index) => o.trim() ? [q.options_zu[index]?.trim() ?? ''] : []) }
        : {}),
    }));
    await createSurvey({ org_name: orgName.trim(), title: title.trim(), ...(titleZu.trim() ? { title_zu: titleZu.trim() } : {}), questions: finalQs });
    setSaving(false);
    setSaved(true);
    setTitle('');
    setTitleZu('');
    setOrgName(profile?.full_name ?? '');
    setQuestions([{ _key: makeQuestionId(0), text: '', text_zu: '', type: 'yesno', options: [], options_zu: [] }]);
    setTimeout(() => { setSaved(false); setOpen(false); onCreated(); }, 1800);
  }

  const canSend = title.trim() && orgName.trim() && questions.some((q) => q.text.trim());

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={localUi('Create a new survey', 'Dala inhlolovo entsha', lang)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ width: 34, height: 34, background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.25)' }}>
          <Plus size={16} style={{ color: '#7A4408' }} strokeWidth={1.8} />
        </div>
        <span className="flex-1 font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{localUi('New survey', 'Inhlolovo entsha', lang)}</span>
        {open
          ? <ChevronUp size={15} style={{ color: '#755942' }} />
          : <ChevronDown size={15} style={{ color: '#755942' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="pt-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={localUi('Survey title...', 'Isihloko senhlolovo...', lang)}
              aria-label={localUi('Survey title', 'Isihloko senhlolovo', lang)}
              className="w-full font-display font-semibold text-sm rounded-xl px-3 py-2.5 outline-none"
              style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
            />
            {lang === 'zu' && (
              <input
                value={titleZu}
                onChange={(e) => setTitleZu(e.target.value)}
                placeholder="Isihloko ngesiZulu (uyazikhethela)"
                aria-label="Isihloko senhlolovo ngesiZulu (uyazikhethela)"
                className="w-full font-display font-semibold text-sm rounded-xl px-3 py-2.5 outline-none"
                style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
              />
            )}
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={localUi('Organisation name...', 'Igama lenhlangano...', lang)}
              aria-label={localUi('Organisation name', 'Igama lenhlangano', lang)}
              className="w-full font-sans text-sm rounded-xl px-3 py-2 outline-none"
              style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="text-xs font-sans uppercase tracking-wider" style={{ color: '#755942', letterSpacing: '0.08em' }}>
            {localUi('Questions', 'Imibuzo', lang)}
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
            <Plus size={14} strokeWidth={1.8} /> {localUi('Add question', 'Engeza umbuzo', lang)}
          </button>

          {sampleNote && (
            <p className="text-xs font-sans rounded-xl px-3 py-2" style={{ background: 'rgba(192,122,30,0.09)', color: '#7A4408', border: '1px solid rgba(192,122,30,0.2)' }}>
              {localUi('tour mode — connect Firebase to save surveys live.', 'Imodi yokubonisa — xhuma i-Firebase ukuze ulondoloze izinhlolovo.', lang)}
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
            {saving ? localUi('Sending...', 'Iyathunyelwa...', lang) : saved ? localUi('Survey sent!', 'Inhlolovo ithunyelwe!', lang) : localUi('Send survey', 'Thumela inhlolovo', lang)}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Staff: existing survey card ──────────────────────────────────────────────

function SurveyLabelEditor({ survey, onSaved }: { survey: Survey; onSaved: () => void }) {
  const [titleZu, setTitleZu] = useState(survey.title_zu ?? '');
  const [questionsZu, setQuestionsZu] = useState(() => survey.questions.map((q) => ({
    id: q.id,
    text_zu: q.text_zu ?? '',
    options_zu: q.options.map((_, index) => q.options_zu?.[index] ?? ''),
  })));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  async function saveLabels() {
    setSaving(true);
    setError(false);
    try {
      await updateSurveyIsiZuluLabels(survey.id, {
        source_title: survey.title,
        title_zu: titleZu,
        questions: questionsZu.map((q, index) => ({
          ...q,
          source_text: survey.questions[index].text,
          source_options: survey.questions[index].options,
        })),
      });
      setSaved(true);
      onSaved();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="space-y-1">
        <div className="text-xs font-semibold" style={{ color: '#5C5040' }}>{localUi('English source', 'Umthombo wesiNgisi', 'zu')}: {survey.title}</div>
        <input
          value={titleZu}
          onChange={(e) => setTitleZu(e.target.value)}
          placeholder="Isihloko senhlolovo ngesiZulu"
          aria-label={`Isihloko ngesiZulu: ${survey.title}`}
          className="w-full font-display font-semibold text-sm rounded-xl px-3 py-2 outline-none"
          style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
        />
      </div>

      {survey.questions.map((question, questionIndex) => (
        <div key={question.id} className="space-y-2 rounded-xl p-3" style={{ background: 'rgba(31,77,43,0.04)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-semibold" style={{ color: '#5C5040' }}>{localUi('English question', 'Umbuzo wesiNgisi', 'zu')}: {question.text}</div>
          <input
            value={questionsZu[questionIndex]?.text_zu ?? ''}
            onChange={(e) => setQuestionsZu((current) => current.map((q, index) => index === questionIndex ? { ...q, text_zu: e.target.value } : q))}
            placeholder="Umbuzo ngesiZulu"
            aria-label={`Umbuzo ngesiZulu: ${question.text}`}
            className="w-full font-sans text-sm rounded-xl px-3 py-2 outline-none"
            style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
          />
          {question.options.map((option, optionIndex) => (
            <div key={`${question.id}-option-${optionIndex}`} className="space-y-1">
              <div className="text-xs" style={{ color: '#5C5040' }}>{localUi('English choice', 'Impendulo yesiNgisi', 'zu')}: {option}</div>
              <input
                value={questionsZu[questionIndex]?.options_zu[optionIndex] ?? ''}
                onChange={(e) => setQuestionsZu((current) => current.map((q, index) => index === questionIndex
                  ? { ...q, options_zu: q.options_zu.map((value, i) => i === optionIndex ? e.target.value : value) }
                  : q))}
                placeholder="Impendulo ngesiZulu"
                aria-label={`Impendulo ngesiZulu: ${option}`}
                className="w-full font-sans text-sm rounded-xl px-3 py-2 outline-none"
                style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
        </div>
      ))}

      <p className="text-xs" style={{ color: '#5C5040' }}>Izimpendulo esezithunyelwe zihlala zinjalo.</p>
      {error && <p role="alert" className="text-xs" style={{ color: '#9A3328' }}>Ayikwazanga ukulondoloza. Hlola ukuxhumana kwakho bese uzama futhi.</p>}
      <button
        onClick={saveLabels}
        disabled={saving}
        className="w-full py-2.5 rounded-xl font-display font-semibold text-sm"
        style={{ background: '#1F4D2B', color: '#EAF3E2', border: 'none', cursor: saving ? 'wait' : 'pointer' }}
      >
        {saving ? 'Iyalondoloza…' : saved ? 'Kulondoloziwe' : 'Londoloza amagama esiZulu'}
      </button>
    </div>
  );
}

function StaffSurveyCard({ survey, isLive, canEditLabels, onSaved }: { survey: Survey; isLive: boolean; canEditLabels: boolean; onSaved: () => void }) {
  const { lang } = useLanguage();
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [editingLabels, setEditingLabels] = useState(false);

  useEffect(() => {
    if (!isLive) { setResponseCount(Math.floor(Math.random() * 12)); return; }
    // countSurveyResponses(), not listSurveyResponses().length — this badge only ever needed the
    // number, and the list form was pulling every farmer's full free-text answers over the wire
    // (up to one document per farmer in the org) just to discard them. See lib/db/queries.ts.
    countSurveyResponses(survey.id).then(setResponseCount);
  }, [survey.id, isLive]);

  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm break-words" style={{ color: 'var(--text-primary)' }}>{showSurveyText(survey, survey.title, SAMPLE_SURVEY_ZU_DRAFTS[survey.id]?.title, survey.title_zu, lang)}</div>
          <div className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>
            {survey.org_name} &middot; {survey.questions.length} {localUi('question', 'umbuzo', lang)}{survey.questions.length !== 1 ? (lang === 'zu' ? '' : 's') : ''}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.18)' }}>
          <ClipboardList size={11} style={{ color: '#1F4D2B' }} strokeWidth={1.8} />
          <span className="font-display font-semibold text-xs" style={{ color: '#1F4D2B' }}>
            {responseCount === null ? '—' : responseCount} {localUi('response', 'impendulo', lang)}{responseCount !== 1 && lang !== 'zu' ? 's' : ''}
          </span>
        </div>
      </div>
      {lang === 'zu' && isLive && canEditLabels && (
        <>
          <button
            type="button"
            onClick={() => setEditingLabels((open) => !open)}
            aria-expanded={editingLabels}
            className="mt-3 text-xs font-display font-semibold"
            style={{ color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {editingLabels ? 'Vala ukuhlela' : 'Faka noma ubuyekeze amagama esiZulu'}
          </button>
          {editingLabels && <SurveyLabelEditor survey={survey} onSaved={onSaved} />}
        </>
      )}
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
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(answered);
  const [submitError, setSubmitError] = useState(false);

  function setAnswer(qid: string, val: string) {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
    setSubmitError(false);
  }

  const allAnswered = survey.questions.every((q) => answers[q.id] !== undefined && answers[q.id] !== '');

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      if (isLive) {
        await addSurveyResponse(survey.id, answers);
      }
      setSubmitted(true);
      setOpen(false);
      onAnswered(survey.id);
    } catch {
      // Leave the farmer's entered answers in place so they can retry after reconnecting.
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => { if (!submitted) setOpen((o) => !o); }}
        disabled={submitted}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: submitted ? 'default' : 'pointer' }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm break-words" style={{ color: 'var(--text-primary)' }}>{showSurveyText(survey, survey.title, SAMPLE_SURVEY_ZU_DRAFTS[survey.id]?.title, survey.title_zu, lang)}</div>
          <div className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>
            {localUi('From', 'Kuvela ku', lang)} {survey.org_name} &middot; {survey.questions.length} {localUi('question', 'umbuzo', lang)}{survey.questions.length !== 1 && lang !== 'zu' ? 's' : ''}
          </div>
        </div>
        {submitted ? (
          <div className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.25)' }}>
            <Check size={12} style={{ color: '#1F4D2B' }} strokeWidth={2} />
            <span className="font-display font-semibold text-xs" style={{ color: '#1F4D2B' }}>{localUi('Answered', 'Kuphenduliwe', lang)}</span>
          </div>
        ) : open ? (
          <ChevronUp size={15} style={{ color: '#755942', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={15} style={{ color: '#755942', flexShrink: 0 }} />
        )}
      </button>

      {open && !submitted && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
          {survey.questions.map((q) => (
            <div key={q.id} className="pt-3 space-y-2">
              <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{showSurveyText(survey, q.text, SAMPLE_SURVEY_ZU_DRAFTS[survey.id]?.questions?.[q.id], q.text_zu, lang)}</div>

              {q.type === 'yesno' && (
                <div className="flex gap-2">
                  {['Yes', 'No'].map((v) => {
                    const on = answers[q.id] === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setAnswer(q.id, v)}
                        aria-pressed={on}
                        className="flex-1 py-2.5 rounded-xl font-display font-semibold text-sm"
                        style={{
                          background: on ? '#1F4D2B' : '#fff',
                          color: on ? '#EAF3E2' : 'var(--text-primary)',
                          border: `1px solid ${on ? '#1F4D2B' : '#D8CBB2'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {lang === 'zu' && survey.id.startsWith('sample-')
                          ? showSampleDraft(survey, v, v === 'Yes' ? 'Yebo' : 'Cha', lang)
                        : lang === 'zu' ? `${v === 'Yes' ? 'Yebo' : 'Cha'} / ${v}` : v}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'choice' && (
                <div className="space-y-1.5">
                  {q.options.map((opt, optionIndex) => {
                    const on = answers[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setAnswer(q.id, opt)}
                        aria-pressed={on}
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
                        <span className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>{showSurveyText(survey, opt, SAMPLE_SURVEY_ZU_DRAFTS[survey.id]?.options?.[opt], q.options_zu?.[optionIndex], lang)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder={localUi('Your answer...', 'Impendulo yakho...', lang)}
                  aria-label={localUi('Your answer', 'Impendulo yakho', lang)}
                  rows={3}
                  className="w-full font-sans text-sm rounded-xl px-3 py-2.5 outline-none resize-none"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: 'var(--text-primary)' }}
                />
              )}
            </div>
          ))}

          {submitError && (
            <p role="alert" className="text-sm font-sans rounded-xl px-3 py-2" style={{ background: 'rgba(154,52,18,0.08)', color: '#7A2E16', border: '1px solid rgba(154,52,18,0.25)' }}>
              {lang === 'zu'
                ? 'Izimpendulo zakho zisekhona. Asikwazanga ukuzithumela. Hlola uxhumano lwakho bese uthepha okuthi Thumela futhi. / Your answers are still here. We could not submit them. Check your connection and tap Submit again.'
                : 'Your answers are still here. We could not submit them. Check your connection and tap Submit again.'}
            </p>
          )}

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
            {submitting ? localUi('Submitting...', 'Kuyathunyelwa...', lang) : localUi('Submit', 'Thumela', lang)}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurveysPage() {
  const { lang } = useLanguage();
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const isStaff = role !== null && STAFF_ROLES.has(role);
  // null covers both "not signed in" (the sample tour's participant preview) and a role still
  // resolving on first render — the page's own !loading guard above handles the latter.
  const canAnswer = role === null || ANSWER_ROLES.has(role);

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
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3"
        style={APP_HEADER_STYLE}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>{localUi('Surveys', 'Izinhlolovo', lang)}</span>
        <div className="flex-1" />
        <LessonLink id="surveys:overview" label={localUi('Learn', 'Funda', lang)} />
        <SettingsButton />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 80 }}>

        {lang === 'zu' && (
          <p role="note" className="rounded-xl px-3 py-2 text-xs font-sans" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', color: '#5C5040' }}>
            {lang === 'zu'
              ? 'ISIZULU DRAFT — Built-in demonstration text is an unreviewed AI draft. For live surveys, an organisation may enter isiZulu labels; they appear beside the exact English text and have not been independently reviewed. Ask the survey creator before submitting if anything is unclear. / UHLAKA LWESIZULU — Umbhalo wezibonelo owakhelwe ngaphakathi uwuhlaka lwe-AI olungakabuyekezwa. Kuhlolovo olubukhoma, inhlangano ingafaka amagama esiZulu; aboniswa eduze kombhalo wesiNgisi oqondile futhi awabuyekezwanga ngokuzimela. Buza umdali wenhlolovo uma kukhona okungacacile ngaphambi kokuthumela.'
              : ''}
          </p>
        )}

        {/* Section heading */}
        <div className="flex items-center gap-2.5">
          <ClipboardList size={16} style={{ color: '#1F4D2B' }} strokeWidth={1.7} />
          <h1 className="font-display font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {isStaff ? localUi('Survey builder', 'Ukwakha inhlolovo', lang) : canAnswer ? localUi('Available surveys', 'Izinhlolovo ezitholakalayo', lang) : localUi('Surveys', 'Izinhlolovo', lang)}
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
              <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
                <ClipboardList size={26} style={{ color: '#755942', margin: '0 auto 8px' }} strokeWidth={1.5} />
                <p className="font-display text-sm" style={{ color: '#5C5040' }}>
                  {localUi('No surveys yet. Build the first one above.', 'Azikho izinhlolovo okwamanje. Yakha eyokuqala ngenhla.', lang)}
                </p>
              </div>
            ) : (
              <>
                <div className="text-xs font-sans uppercase tracking-wider" style={{ color: '#755942', letterSpacing: '0.08em' }}>
                  {localUi('Existing surveys', 'Izinhlolovo ezikhona', lang)}
                </div>
                <div className="space-y-3">
                  {surveys.map((s) => (
                    <StaffSurveyCard key={s.id} survey={s} isLive={isLive} canEditLabels={s.created_by === user?.uid} onSaved={load} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Farmer / student view — the only accounts a survey is meant to be answered by,
            besides a signed-out participant in the sample tour (role === null). */}
        {!isStaff && canAnswer && (
          <>
            {fetching ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} className="animate-spin" style={{ color: '#1F4D2B' }} />
              </div>
            ) : surveys.length === 0 ? (
              <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
                <ClipboardList size={26} style={{ color: '#755942', margin: '0 auto 8px' }} strokeWidth={1.5} />
                <p className="font-display text-sm" style={{ color: '#5C5040' }}>
                  {localUi('No surveys available right now.', 'Azikho izinhlolovo ezitholakalayo okwamanje.', lang)}
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

        {/* Verified bug: mentor and funder accounts are neither staff (the builder) nor who a
            survey is meant to be answered by — they used to fall through to the same answer
            flow as a farmer, with nothing stopping them submitting a response. */}
        {!isStaff && !canAnswer && (
          <div className="rounded-2xl px-4 py-8 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
            <ClipboardList size={26} style={{ color: '#755942', margin: '0 auto 8px' }} strokeWidth={1.5} />
            <p className="font-display text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {localUi('Surveys are answered by farmers and students', 'Izinhlolovo ziphendulwa abalimi nabafundi', lang)}
            </p>
            <p className="font-sans text-xs" style={{ color: '#5C5040' }}>
              {localUi('Your organisation’s survey builder is available to NGO staff.', 'Ukwakha inhlolovo yenhlangano yakho kutholakala kubasebenzi be-NGO.', lang)}
            </p>
          </div>
        )}

        {!isLive && (
          <p className="text-center text-xs font-sans" style={{ color: '#755942' }}>
            {localUi('demonstration records — connect Firebase to go live', 'Amarekhodi okuboniswayo — xhuma i-Firebase ukuze usebenzise uhlelo olubukhoma', lang)}
          </p>
        )}
      </main>

      <TabBar />
    </div>
  );
}
