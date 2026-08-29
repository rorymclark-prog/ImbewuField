'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Circle, Clock, Loader2, GraduationCap, Sprout, ChevronDown, ChevronUp, BookOpen, Home, Lightbulb, CalendarClock, AlertTriangle, ClipboardList, Headphones, Video, ExternalLink, Lock, Camera, Mic, Trophy, PlayCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import {
  myCourseProgress, setCourseProgress, myAssignments,
  myCourseSubmissions, submitCourseModule, uploadCourseSubmissionFile,
} from '@/lib/db/queries';
import { COURSE_MODULES, TOTAL_MODULES, CATEGORY_COLORS, LESSON_INDEX, type ModuleCategory, type Lesson } from '@/lib/course-modules';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import CourseAudioPlayer from '@/components/course/CourseAudioPlayer';
import LessonInfographic from '@/components/course/LessonInfographic';
import DeckPlayer from '@/components/course/DeckPlayer';
import OfflineDownload from '@/components/course/OfflineDownload';
import MenuButton from '@/components/MenuButton';
import { hasDeck, deckSlideCount } from '@/lib/course-deck';
import { isModuleComplete_Content, readinessLabel } from '@/lib/course-readiness';
import { useLanguage } from '@/lib/i18n';
import { allTracks, hasNarration, tracksForLesson } from '@/lib/course-audio';
import {
  assignmentState, formatDue, orderModulesForLearner, summariseAssignments, toDateKey,
  type AssignmentState, type CourseAssignment,
} from '@/lib/course-assignments';
import {
  isModuleUnlocked, currentModuleId, isCapstoneUnlocked, unlockReason,
  assignmentFor, submittedModuleIds,
  type GatingContext, type CourseSubmission, type ModuleAssignment,
} from '@/lib/course-gating';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  foundation: 'Foundation',
  water:      'Water',
  soil:       'Soil',
  plants:     'Plants',
  design:     'Design',
  business:   'Business',
  seeds:      'Seeds',
};

/** Curriculum position, fixed. The list below re-orders to put assigned work first, but
 *  "module 7" must keep meaning the same module whichever order it is shown in. */
const MODULE_NUMBER = new Map(COURSE_MODULES.map((m, i) => [m.id, i + 1] as const));

const ASSIGNMENT_TONE: Record<AssignmentState, { fg: string; bg: string; border: string }> = {
  overdue:    { fg: '#B03A2E', bg: 'rgba(176,58,46,0.10)',  border: 'rgba(176,58,46,0.30)' },
  'due-soon': { fg: '#C07A1E', bg: 'rgba(192,122,30,0.10)', border: 'rgba(192,122,30,0.30)' },
  open:       { fg: '#235E86', bg: 'rgba(35,94,134,0.10)',  border: 'rgba(35,94,134,0.28)' },
  done:       { fg: '#1F4D2B', bg: 'rgba(31,77,43,0.10)',   border: 'rgba(31,77,43,0.28)' },
};

function formatDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim();
}

// ── Quiz question ────────────────────────────────────────────────────────────

function QuizQuestion({ q, options, correct, rationale }: { q: string; options: string[]; correct: number; rationale?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const revealed = selected !== null;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(32,25,15,0.04)', border: '1px solid rgba(32,25,15,0.08)' }}>
      <p className="font-sans text-sm font-semibold leading-snug" style={{ color: '#20190F' }}>{q}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === correct;

          let bg = 'rgba(32,25,15,0.04)';
          let border = '1px solid rgba(32,25,15,0.10)';
          let textColor = '#5C5040';

          if (revealed) {
            if (isCorrect) {
              bg = 'rgba(31,77,43,0.10)';
              border = '1px solid rgba(31,77,43,0.35)';
              textColor = '#1F4D2B';
            } else if (isSelected) {
              bg = 'rgba(180,30,30,0.08)';
              border = '1px solid rgba(180,30,30,0.30)';
              textColor = '#8B2020';
            }
          }

          return (
            <button
              key={i}
              onClick={() => { if (!revealed) setSelected(i); }}
              disabled={revealed}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-sans leading-snug transition-all"
              style={{ background: bg, border, color: textColor, cursor: revealed ? 'default' : 'pointer' }}
            >
              <span className="font-mono text-xs mr-2" style={{ opacity: 0.5 }}>{String.fromCharCode(65 + i)}.</span>
              {opt}
              {revealed && isCorrect && (
                <span className="ml-2 text-xs font-semibold" style={{ color: '#1F4D2B' }}>Correct</span>
              )}
              {revealed && isSelected && !isCorrect && (
                <span className="ml-2 text-xs font-semibold" style={{ color: '#8B2020' }}>
                  Incorrect — see {String.fromCharCode(65 + correct)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {revealed && rationale && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.22)' }}>
          <Lightbulb size={13} style={{ color: '#C07A1E', flexShrink: 0, marginTop: 2 }} />
          <p className="font-sans text-xs leading-relaxed" style={{ color: '#5C5040' }}>{rationale}</p>
        </div>
      )}
    </div>
  );
}

// ── Lesson accordion panel ───────────────────────────────────────────────────

function LessonPanel({ lesson, color, moduleId, lang, autoOpen, onJumpToLesson }: {
  lesson: Lesson; color: string; moduleId: string; lang: string;
  /** True for exactly one render after a "related lessons" jump targets this lesson — see
   *  jumpToLesson() below. A one-way switch: it opens the panel, but going false again never
   *  closes it back up. */
  autoOpen?: boolean;
  onJumpToLesson: (lessonId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // The slide player is opt-in per lesson and resets when the panel is left. Nothing in the deck
  // downloads until it is opened, and reopening a lesson should not re-spend anyone's data.
  const [deckOpen, setDeckOpen] = useState(false);
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  const lessonTracks = tracksForLesson(moduleId, lesson.id);
  const hasAudio = lessonTracks.length > 0;
  const hasInfographic = Boolean(lesson.infographicUrl && lesson.infographicAlt);
  const hasLeadIn = hasAudio || hasInfographic;

  // Silently drop any related-lesson id that doesn't resolve to a real lesson, rather than
  // rendering a dead button — tests/course-content.test.ts is what catches the bad data itself.
  const related = (lesson.relatedLessonIds ?? [])
    .map((id) => LESSON_INDEX.get(id))
    .filter((entry): entry is { lesson: Lesson; moduleId: string } => Boolean(entry));

  return (
    // Anchors "related lessons" jumps from other lessons to this one (see jumpToLesson).
    <div id={`lesson-${lesson.id}`} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}22`, scrollMarginTop: 64 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: open ? `${color}0F` : 'transparent' }}
      >
        <BookOpen size={14} style={{ color, flexShrink: 0 }} />
        <span className="flex-1 font-sans text-sm font-semibold leading-snug" style={{ color: '#20190F' }}>
          {lesson.title}
        </span>
        {open
          ? <ChevronUp size={14} style={{ color: '#8C7A62', flexShrink: 0 }} />
          : <ChevronDown size={14} style={{ color: '#8C7A62', flexShrink: 0 }} />}
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5" style={{ borderTop: `1px solid ${color}18` }}>
          {hasAudio && (
            <div className="pt-4">
              <CourseAudioPlayer
                moduleId={moduleId}
                appLang={lang}
                tracks={lessonTracks}
                label="Listen to this lesson"
              />
            </div>
          )}

          {/* Watch and listen — the lesson in the form it was authored in: slides, in order, with
              narration and the animations that a still cannot carry. Opt-in, and it replaces
              nothing: the reading below stays exactly as it was for anyone who prefers to read, or
              whose connection makes slides a bad idea today. */}
          {hasDeck(moduleId) && (
            <div className={hasAudio ? '' : 'pt-4'}>
              {deckOpen ? (
                <DeckPlayer moduleId={moduleId} lang={lang} lessonId={lesson.id} onClose={() => setDeckOpen(false)} />
              ) : (
                <button
                  onClick={() => setDeckOpen(true)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left"
                  style={{ border: `1px solid ${color}33`, background: `${color}0C` }}
                >
                  <PlayCircle size={18} style={{ color, flexShrink: 0 }} />
                  <span className="flex-1">
                    <span className="block font-sans text-sm font-semibold" style={{ color: '#20190F' }}>
                      Watch and listen
                    </span>
                    <span className="block font-sans text-xs" style={{ color: '#5C5040' }}>
                      {deckSlideCount(moduleId, lesson.id)} slides, narrated. Nothing downloads until you press play.
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Infographic — a diagram frames the reading, so it sits after audio, before body */}
          {hasInfographic && (
            <div className={hasAudio ? '' : 'pt-4'}>
              <LessonInfographic url={lesson.infographicUrl!} alt={lesson.infographicAlt!} />
            </div>
          )}

          {/* Body */}
          <div className={hasLeadIn ? 'space-y-3' : 'space-y-3 pt-4'}>
            {lesson.body.split('\n\n').map((para, i) => (
              <p key={i} className="font-sans text-sm leading-relaxed" style={{ color: '#3A3020' }}>
                {para}
              </p>
            ))}
          </div>

          {/* Key points */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: `${color}0C`, border: `1px solid ${color}20` }}>
            <p className="font-display font-semibold text-xs uppercase tracking-wide" style={{ color }}>Key Points</p>
            <ul className="space-y-1.5">
              {lesson.keyPoints.map((kp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 flex-shrink-0 rounded-full" style={{ width: 5, height: 5, background: color }} />
                  <span className="font-sans text-sm leading-snug" style={{ color: '#3A3020' }}>{kp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Facilitator video — a link, never an inline player: KZN connectivity cannot
              stream video per-visit, so a farmer must never land on this by accident. */}
          {lesson.videoUrl && (
            <a
              href={lesson.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl transition-colors"
              style={{ background: 'rgba(140,122,98,0.08)', border: '1px solid #E2D8C4' }}
            >
              <Video size={14} style={{ color: '#8C7A62', flexShrink: 0 }} />
              <span className="flex-1 font-sans text-xs leading-snug" style={{ color: '#5C5040' }}>
                Facilitator training video — for in-person sessions, not for streaming here.
              </span>
              <ExternalLink size={12} style={{ color: '#8C7A62', flexShrink: 0 }} />
            </a>
          )}

          {/* Quiz */}
          <div className="space-y-3">
            <p className="font-display font-semibold text-xs uppercase tracking-wide" style={{ color: '#8C7A62' }}>
              Check your understanding
            </p>
            {lesson.quiz.map((q, i) => (
              <QuizQuestion key={i} q={q.q} options={q.options} correct={q.correct} rationale={q.rationale} />
            ))}
          </div>

          {/* Related lessons — jumps to another lesson's panel; a dangling id is filtered out
              above rather than rendered as a dead button. */}
          {related.length > 0 && (
            <div className="space-y-2">
              <p className="font-display font-semibold text-xs uppercase tracking-wide" style={{ color: '#8C7A62' }}>
                Related lessons
              </p>
              <div className="flex flex-wrap gap-2">
                {related.map(({ lesson: rl }) => (
                  <button
                    key={rl.id}
                    type="button"
                    onClick={() => onJumpToLesson(rl.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-sans font-medium text-left transition-colors"
                    style={{ background: `${color}0F`, border: `1px solid ${color}30`, color, cursor: 'pointer' }}
                  >
                    {rl.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Submission screen (photo + self-check + optional voice — NO text inputs) ────────────────
//
// Deliberate accessibility constraint, not an omission: low-literacy, isiZulu-first learners on
// entry-level Android. Every self-check item is a tap target, the photo/voice pickers are
// explicit-tap (never auto-uploaded on file pick — the network cost only happens on Submit, which
// matters on metered data). MODULE_ASSIGNMENTS ships empty (lib/course-gating.ts), so in practice
// this never renders yet — see assignmentFor() gating its render site below.

function SubmissionPanel({ moduleId, assignment, color, existing, onSubmitted }: {
  moduleId: string;
  assignment: ModuleAssignment;
  color: string;
  existing?: CourseSubmission;
  onSubmitted: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(existing?.self_check ?? []));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);

  function toggleCheck(item: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item); else next.add(item);
      return next;
    });
  }

  // File pickers only STAGE the file locally (with a local preview) — no network call here.
  // The upload happens once, inside handleSubmit, on the learner's explicit Submit tap.
  function onPickPhoto(file: File | undefined) {
    if (!file) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPhotoFile(file);
    setPhotoPreview(url);
  }

  async function handleSubmit() {
    if (!photoFile || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const photo_path = await uploadCourseSubmissionFile(moduleId, photoFile, 'photo');
      const voice_path = voiceFile ? await uploadCourseSubmissionFile(moduleId, voiceFile, 'voice') : null;
      await submitCourseModule({ module: moduleId, self_check: [...checked], photo_path, voice_path });
      onSubmitted();
    } catch {
      setError('Could not submit — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(photoFile) && !submitting;

  return (
    <div className="rounded-xl p-4 space-y-3.5" style={{ background: `${color}0A`, border: `1px solid ${color}25` }}>
      <p className="font-sans text-sm leading-relaxed" style={{ color: '#3A3020' }}>{assignment.prompt}</p>

      {assignment.selfCheckItems.length > 0 && (
        <div className="space-y-1.5">
          {assignment.selfCheckItems.map((item) => {
            const isChecked = checked.has(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleCheck(item)}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg transition-colors"
                style={{ background: isChecked ? `${color}14` : 'rgba(32,25,15,0.03)', border: `1px solid ${isChecked ? `${color}40` : '#E2D8C4'}` }}
              >
                {isChecked
                  ? <CheckCircle size={15} style={{ color, flexShrink: 0 }} />
                  : <Circle size={15} style={{ color: '#8C7A62', flexShrink: 0 }} />}
                <span className="font-sans text-sm" style={{ color: '#3A3020' }}>{item}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Photo — required, explicit-tap only */}
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => onPickPhoto(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => photoInputRef.current?.click()}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl transition-colors"
        style={{ background: '#FFFEFA', border: `1px dashed ${photoPreview ? color : '#E2D8C4'}` }}
      >
        {photoPreview
          ? <img src={photoPreview} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          : <Camera size={16} style={{ color, flexShrink: 0 }} />}
        <span className="flex-1 font-sans text-xs text-left" style={{ color: '#5C5040' }}>
          {photoPreview ? 'Photo added — tap to change' : 'Add a photo (required)'}
        </span>
      </button>

      {/* Voice note — optional, explicit-tap only */}
      <input ref={voiceInputRef} type="file" accept="audio/*" className="hidden"
        onChange={(e) => setVoiceFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => voiceInputRef.current?.click()}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl transition-colors"
        style={{ background: '#FFFEFA', border: `1px dashed ${voiceFile ? color : '#E2D8C4'}` }}
      >
        <Mic size={16} style={{ color: voiceFile ? color : '#8C7A62', flexShrink: 0 }} />
        <span className="flex-1 font-sans text-xs text-left" style={{ color: '#5C5040' }}>
          {voiceFile ? `Voice note added — ${voiceFile.name}` : 'Add a voice note (optional)'}
        </span>
      </button>

      {error && <p className="font-sans text-xs" style={{ color: '#B03A2E' }}>{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all"
        style={{
          background: canSubmit ? color : 'rgba(226,216,196,0.6)',
          color: canSubmit ? '#FFFEFA' : '#8C7A62',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting
          ? <><Loader2 size={14} className="animate-spin" />Submitting...</>
          : existing ? 'Resubmit' : 'Submit'}
      </button>

      {existing && (
        <p className="font-sans text-xs text-center" style={{ color: '#8C7A62' }}>
          Already submitted — submitting again replaces the photo and voice note.
        </p>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const STUDENT_ALLOWED_ROLES = new Set(['student', 'farmer', 'ngo', 'funder', 'admin']);

export default function StudentPage() {
  const { user, role, loading } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [submissions, setSubmissions] = useState<CourseSubmission[]>([]);
  // Which module's submission screen is expanded — one at a time, mirrors expandedModuleId.
  const [submissionOpenId, setSubmissionOpenId] = useState<string | null>(null);
  // Resolved after mount, never during render: `new Date()` on the server and on the client
  // can straddle midnight and produce a hydration mismatch. Until it lands we show the plain
  // curriculum order with no deadline badges, which is exactly the pre-assignment behaviour.
  const [today, setToday] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [progressError, setProgressError] = useState(false);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  // Set by a "related lessons" jump, cleared once the scroll below has fired. One-shot signal,
  // not durable UI state — see jumpToLesson() and the effect that consumes it.
  const [jumpToLessonId, setJumpToLessonId] = useState<string | null>(null);

  useEffect(() => { setToday(toDateKey(new Date())); }, []);

  useEffect(() => {
    // Sample mode has no user by design; bouncing it to /login would make the
    // student demo unreachable on production, where a backend is always configured.
    if (!loading && !user && isLive && !isSampleMode()) router.replace('/login');
  }, [user, loading, router, isLive]);

  const load = useCallback(async () => {
    setFetching(true);
    setProgressError(false);
    try {
      if (isLive && user) {
        // An assignments/submissions read that fails (rules, offline) must not blank out
        // progress — the learner can still work through the course without a mentor's list.
        let rows: Awaited<ReturnType<typeof myCourseProgress>> = [];
        try {
          rows = await myCourseProgress();
        } catch {
          // A denied progress read is different from a learner who has completed nothing.
          setProgressError(true);
        }
        const [mine, subs] = await Promise.all([
          myAssignments().catch(() => [] as CourseAssignment[]),
          myCourseSubmissions().catch(() => [] as CourseSubmission[]),
        ]);
        setDoneIds(new Set(rows.filter((r) => r.done).map((r) => r.module)));
        setAssignments(mine);
        setSubmissions(subs);
      }
    } catch {
      setProgressError(true);
    } finally {
      setFetching(false);
    }
  }, [isLive, user]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  async function toggle(moduleId: string) {
    const willBeDone = !doneIds.has(moduleId);
    // Optimistic update
    setDoneIds((prev) => {
      const next = new Set(prev);
      willBeDone ? next.add(moduleId) : next.delete(moduleId);
      return next;
    });
    if (isLive) {
      setToggling(moduleId);
      try {
        await setCourseProgress(moduleId, willBeDone);
      } catch {
        setProgressError(true);
        setDoneIds((prev) => {
          const next = new Set(prev);
          willBeDone ? next.delete(moduleId) : next.add(moduleId);
          return next;
        });
      } finally {
        setToggling(null);
      }
    }
  }

  function toggleExpand(moduleId: string) {
    setExpandedModuleId((prev) => (prev === moduleId ? null : moduleId));
  }

  /** Expand the module that owns lessonId and scroll its panel into view. A dangling id (one
   *  that doesn't resolve) is a no-op — the button that would have called this is never
   *  rendered in the first place, since LessonPanel already filters those out. */
  function jumpToLesson(lessonId: string) {
    const owner = LESSON_INDEX.get(lessonId);
    if (!owner) return;
    setExpandedModuleId(owner.moduleId);
    setJumpToLessonId(lessonId);
  }

  // Runs once the target module's lessons are in the DOM (both state updates above land in the
  // same commit), scrolls the target panel into view, then clears the one-shot signal.
  useEffect(() => {
    if (!jumpToLessonId) return;
    document.getElementById(`lesson-${jumpToLessonId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setJumpToLessonId(null);
  }, [jumpToLessonId, expandedModuleId]);

  const assignmentByModule = useMemo(() => {
    const m = new Map<string, CourseAssignment>();
    for (const a of assignments) m.set(a.module, a);
    return m;
  }, [assignments]);

  /** Outstanding assigned work floats to the top; the full syllabus is still listed. */
  const orderedModules = useMemo(() => {
    if (!today || assignments.length === 0) return COURSE_MODULES;
    const byId = new Map(COURSE_MODULES.map((m) => [m.id, m] as const));
    return orderModulesForLearner(COURSE_MODULES.map((m) => m.id), assignments, doneIds, today)
      .map((id) => byId.get(id))
      .filter((m): m is (typeof COURSE_MODULES)[number] => Boolean(m));
  }, [today, assignments, doneIds]);

  const assignSummary = useMemo(
    () => (today && assignments.length > 0 ? summariseAssignments(assignments, doneIds, today) : null),
    [today, assignments, doneIds],
  );

  // Gating always reasons in fixed CURRICULUM order — never orderedModules above, which is a
  // display-only reordering that lifts assigned work to the top (see lib/course-gating.ts).
  const gatingCtx: GatingContext = useMemo(() => ({
    moduleIds: COURSE_MODULES.map((m) => m.id),
    doneIds,
    submittedIds: submittedModuleIds(submissions),
    assignments,
  }), [doneIds, submissions, assignments]);

  const currentId = useMemo(() => currentModuleId(gatingCtx), [gatingCtx]);
  const capstoneUnlocked = useMemo(() => isCapstoneUnlocked(gatingCtx), [gatingCtx]);

  const submissionByModule = useMemo(() => {
    const m = new Map<string, CourseSubmission>();
    for (const s of submissions) m.set(s.module, s);
    return m;
  }, [submissions]);

  // Gate: do not render protected content while auth is resolving or user is absent.
  // Sample mode is exempt for the same reason as the redirect above — it has no user
  // by design, and this gate would otherwise spin forever instead of showing the demo.
  if (isLive && (loading || !user) && !isSampleMode()) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
        <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
          <MenuButton />
          <BrandLogo />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: '#1F4D2B' }} />
        </main>
      </div>
    );
  }

  if (!loading && user && isLive && role && !STUDENT_ALLOWED_ROLES.has(role)) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
        <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
          <MenuButton />
          <BrandLogo />
          <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
          <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Learning Portal</span>
          <div className="flex-1" />
          <SettingsButton />
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: 'rgba(31,77,43,0.08)' }}>
              <GraduationCap size={22} style={{ color: '#1F4D2B' }} />
            </div>
            <p className="text-sm font-display font-semibold mb-1" style={{ color: '#20190F' }}>This is the Learning Portal</p>
            <p className="text-xs font-sans leading-relaxed mb-5" style={{ color: '#8C7A62' }}>
              It&apos;s set up for students — not your role. Head back to your own home to keep going.
            </p>
            <button
              onClick={() => router.push('/home')}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all"
              style={{ background: '#1F4D2B', color: '#F7F2E9' }}
            >
              <Home size={15} />
              Back to my home
            </button>
          </div>
        </main>
        <TabBar />
      </div>
    );
  }

  // Counted against the current curriculum, not the raw rows: a stale course_progress row for
  // a module that has since been removed or renamed must not push this past 100% and show the
  // learner a "127% done" ring. Mirrors enrollmentProgress in lib/course-enrollment.ts, which
  // guards the same drift on the mentor's cohort view (see the ProgressBar fix in app/mentor).
  const doneCount = COURSE_MODULES.filter((m) => doneIds.has(m.id)).length;
  const pct = TOTAL_MODULES === 0 ? 0 : Math.round((doneCount / TOTAL_MODULES) * 100);
  const totalMins = COURSE_MODULES.reduce((s, m) => s + (doneIds.has(m.id) ? 0 : m.durationMins), 0);

  // Arc SVG for progress ring
  const R = 44;
  const C = 2 * Math.PI * R;
  const dashOffset = C - (C * pct) / 100;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Learning Portal</span>
        <div className="flex-1" />
        <LessonLink id="student:overview" label="Learn" />
        <SettingsButton />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 80 }}>

        {/* Progress hero */}
        <div className="rounded-2xl p-5 flex items-center gap-5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          {/* Ring */}
          <div className="flex-shrink-0 relative" style={{ width: 100, height: 100 }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(32,25,15,0.10)" strokeWidth="8" />
              <circle cx="50" cy="50" r={R} fill="none"
                stroke={pct === 100 ? '#1F4D2B' : '#C07A1E'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={fetching ? C : dashOffset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {fetching ? (
                <Loader2 size={20} className="animate-spin" style={{ color: '#1F4D2B' }} />
              ) : (
                <>
                  <span className="font-display font-bold text-xl leading-none" style={{ color: '#20190F' }}>{pct}%</span>
                  <span className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>done</span>
                </>
              )}
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-base leading-tight" style={{ color: '#20190F' }}>
              {pct === 100 ? 'Course complete!' : doneCount === 0 ? 'Ready to start' : 'Keep going'}
            </div>
            <div className="font-sans text-xs mt-1" style={{ color: '#5C5040' }}>
              {doneCount} of {TOTAL_MODULES} modules complete
            </div>
            {progressError && (
              <div className="font-sans text-xs mt-2 leading-relaxed" style={{ color: '#8C4938' }}>
                Progress could not be loaded or saved. Check your connection or account access.
              </div>
            )}
            {pct < 100 && totalMins > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <Clock size={12} style={{ color: '#8C7A62' }} />
                <span className="font-sans text-xs" style={{ color: '#8C7A62' }}>
                  ~{formatDuration(totalMins)} remaining
                </span>
              </div>
            )}
            {pct === 100 && (
              <div className="flex items-center gap-1.5 mt-2">
                <GraduationCap size={13} style={{ color: '#1F4D2B' }} />
                <span className="font-sans text-xs font-semibold" style={{ color: '#1F4D2B' }}>
                  Permaculture practitioner
                </span>
              </div>
            )}
          </div>
        </div>

        {/* What the mentor has actually asked for — only shown when there is something */}
        {assignSummary && assignSummary.total > 0 && (
          <div className="rounded-2xl px-4 py-3.5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={14} style={{ color: '#1F4D2B' }} />
              <span className="font-display text-xs font-semibold uppercase tracking-wide" style={{ color: '#5C5040' }}>
                Set by your mentor
              </span>
            </div>
            <p className="font-sans text-sm leading-relaxed" style={{ color: '#3A3020' }}>
              {assignSummary.done} of {assignSummary.total} done.
              {assignSummary.overdue > 0 && ' '}
              {assignSummary.overdue > 0 && (
                <span style={{ color: '#B03A2E', fontWeight: 600 }}>
                  {assignSummary.overdue} {assignSummary.overdue === 1 ? 'is' : 'are'} overdue.
                </span>
              )}
              {assignSummary.dueSoon > 0 && ' '}
              {assignSummary.dueSoon > 0 && (
                <span style={{ color: '#C07A1E', fontWeight: 600 }}>
                  {assignSummary.dueSoon} due this week.
                </span>
              )}
            </p>
            <p className="font-sans text-xs mt-1.5" style={{ color: '#8C7A62' }}>
              Assigned modules are listed first. Everything else is still open to you.
            </p>
          </div>
        )}

        {/* ONE TAP, THE WHOLE COURSE, WHILE THE SIGNAL IS GOOD.
            The learner is in town roughly once a fortnight; that is the only moment this is cheap.
            It sits above the module list rather than in a settings screen because it is a thing
            you do on purpose before you leave, not a preference you configure. */}
        <OfflineDownload
          moduleIds={orderedModules.map((m) => m.id)}
          lang={lang}
          label="Save the whole course to this phone"
        />

        {/* Module list */}
        <div className="space-y-2.5">
          {orderedModules.map((mod, idx) => {
            const done = doneIds.has(mod.id);
            const isToggling = toggling === mod.id;
            const color = CATEGORY_COLORS[mod.category];
            const isExpanded = expandedModuleId === mod.id;
            const assignment = assignmentByModule.get(mod.id);
            const state = assignment && today ? assignmentState(assignment, doneIds, today) : null;
            const dueText = assignment && today ? formatDue(assignment.due_at, today) : null;

            // A FINISHED MODULE IS ALWAYS OPEN.
            //
            // Rory needs to show the app before the course is finished, and the one module that is
            // genuinely complete — illustrated, narrated in both languages, with its slide deck —
            // sat locked behind five he had not done. So the thing he most wants seen was the one
            // thing nobody could reach.
            //
            // Sequential gating still governs everything else, and it costs nothing here: modules
            // are finished in curriculum order, so in normal use a complete module is one the
            // learner has already unlocked. This only ever opens a module that is ahead of them
            // AND finished, which is exactly the sample case. The badge says which it is.
            const contentComplete = isModuleComplete_Content(mod.id);
            const unlocked = isModuleUnlocked(mod.id, gatingCtx) || contentComplete;
            const isCurrent = currentId === mod.id;

            // LOCKED: content is unreachable, not merely visually hidden — the lessons list
            // itself is never rendered for a locked module (nothing below this branch touches
            // mod.lessons), and there's no expand control to reach it with. No "Mark done"
            // toggle either, so a locked module can't be cheated past by ticking it directly.
            if (!unlocked) {
              const reason = unlockReason(mod.id, gatingCtx);
              return (
                <div key={mod.id} className="rounded-2xl overflow-hidden"
                  style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', opacity: 0.7 }}>
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <div className="flex-shrink-0 flex items-center justify-center rounded-full mt-0.5"
                      style={{ width: 32, height: 32, background: 'rgba(32,25,15,0.06)', border: '1.5px solid #E2D8C4' }}>
                      <Lock size={14} style={{ color: '#8C7A62' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="font-display font-semibold text-sm leading-tight" style={{ color: '#8C7A62' }}>
                          {mod.title}
                        </span>
                        <span className="text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: `${color}10`, color: `${color}A0`, border: `1px solid ${color}20` }}>
                          {CATEGORY_LABELS[mod.category]}
                        </span>
                      </div>
                      <p className="flex items-center gap-1.5 font-sans text-xs mt-1.5 leading-relaxed" style={{ color: '#8C7A62' }}>
                        <Lock size={10} style={{ flexShrink: 0 }} />
                        {reason ?? 'Locked'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            const content = assignmentFor(mod.id);
            const submission = submissionByModule.get(mod.id);
            const submissionOpen = submissionOpenId === mod.id;

            return (
              <div key={mod.id} className="rounded-2xl overflow-hidden"
                style={{ background: '#FFFEFA', border: `1px solid ${isCurrent ? color : (done ? '#1F4D2B30' : '#E2D8C4')}` }}>

                {/* Module header row */}
                <div className="flex items-start gap-3 px-4 py-3.5">
                  {/* Number / check */}
                  <div className="flex-shrink-0 flex items-center justify-center rounded-full mt-0.5"
                    style={{
                      width: 32, height: 32,
                      background: done ? '#1F4D2B' : 'rgba(32,25,15,0.06)',
                      border: `1.5px solid ${done ? '#1F4D2B' : '#E2D8C4'}`,
                      transition: 'background 0.2s, border-color 0.2s',
                    }}>
                    {done
                      ? <CheckCircle size={16} style={{ color: '#EAF3E2' }} />
                      : <span className="font-mono text-xs font-bold" style={{ color: '#8C7A62' }}>{MODULE_NUMBER.get(mod.id) ?? idx + 1}</span>}
                  </div>

                  {/* Content — tap to expand lessons */}
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => toggleExpand(mod.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="font-display font-semibold text-sm leading-tight"
                        style={{ color: done ? '#5C5040' : '#20190F', textDecoration: done ? 'line-through' : 'none' }}>
                        {mod.title}
                      </span>
                      <span className="text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: color + '18', color, border: `1px solid ${color}30` }}>
                        {CATEGORY_LABELS[mod.category]}
                      </span>
                      {isCurrent && (
                        <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: '#1F4D2B18', color: '#1F4D2B', border: '1px solid #1F4D2B30' }}>
                          Continue here
                        </span>
                      )}
                      {/* HOW FINISHED THIS MODULE IS, derived from what is on disk rather than a
                          flag anyone can forget to withdraw. The app is being shown to people
                          before the course is done: without this, one fully-produced module and
                          nine text-only ones look identical, so either the whole course reads as
                          half-built or the finished one is mistaken for the standard. The
                          in-progress wording says what IS there — the lessons are real and
                          readable today; it is the narration and slides that are still coming. */}
                      <span
                        title={readinessLabel(mod.id)?.detail}
                        className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={contentComplete
                          ? { background: '#1F4D2B', color: '#EAF3E2', border: '1px solid #1F4D2B' }
                          : { background: 'rgba(32,25,15,0.05)', color: '#8C7A62', border: '1px solid #E2D8C4' }}
                      >
                        {readinessLabel(mod.id)?.text}
                      </span>
                      {state && state !== 'done' && (
                        <span className="flex items-center gap-1 text-xs font-sans px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: ASSIGNMENT_TONE[state].bg,
                            color: ASSIGNMENT_TONE[state].fg,
                            border: `1px solid ${ASSIGNMENT_TONE[state].border}`,
                          }}>
                          {state === 'overdue' ? <AlertTriangle size={10} /> : <CalendarClock size={10} />}
                          {dueText ?? 'Assigned'}
                        </span>
                      )}
                    </div>
                    {assignment?.note && (
                      <p className="font-sans text-xs mt-1 leading-relaxed italic" style={{ color: '#5C5040' }}>
                        &ldquo;{assignment.note}&rdquo;
                      </p>
                    )}
                    <p className="font-sans text-xs mt-1 leading-relaxed" style={{ color: '#5C5040' }}>
                      {mod.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} style={{ color: '#8C7A62' }} />
                        <span className="font-mono text-xs" style={{ color: '#8C7A62' }}>{formatDuration(mod.durationMins)}</span>
                      </div>
                      {hasNarration(mod.id) && (
                        <div className="flex items-center gap-1">
                          <Headphones size={11} style={{ color: '#1F4D2B' }} />
                          <span className="font-sans text-xs" style={{ color: '#1F4D2B' }}>Audio</span>
                        </div>
                      )}
                      {mod.lessons && mod.lessons.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="font-sans text-xs" style={{ color: '#8C7A62' }}>
                            {mod.lessons.length} {mod.lessons.length === 1 ? 'lesson' : 'lessons'}
                          </span>
                          {isExpanded
                            ? <ChevronUp size={11} style={{ color: '#8C7A62' }} />
                            : <ChevronDown size={11} style={{ color: '#8C7A62' }} />}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Mark done toggle */}
                  <button
                    onClick={() => toggle(mod.id)}
                    disabled={isToggling}
                    aria-label={done ? 'Mark as not done' : 'Mark as complete'}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold mt-0.5 transition-all"
                    style={{
                      background: done ? 'rgba(31,77,43,0.08)' : '#1F4D2B',
                      border: done ? '1px solid rgba(31,77,43,0.2)' : 'none',
                      color: done ? '#1F4D2B' : '#EAF3E2',
                      cursor: isToggling ? 'wait' : 'pointer',
                      opacity: isToggling ? 0.6 : 1,
                    }}
                  >
                    {isToggling
                      ? <Loader2 size={12} className="animate-spin" />
                      : done
                        ? <><CheckCircle size={12} />Done</>
                        : <><Circle size={12} />Mark done</>}
                  </button>
                </div>

                {/* Lessons panel */}
                {isExpanded && mod.lessons && mod.lessons.length > 0 && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid #E2D8C4' }}>
                    {/* TAKE IT HOME. Sits directly above the players, because it is the answer to
                        the question those players raise: a farmer who has just seen what the
                        slides and narration are worth is the one who wants them on the phone
                        before leaving town. */}
                    <OfflineDownload
                      moduleIds={[mod.id]}
                      lang={lang}
                      compact
                      label={`Save ${mod.title} to this phone`}
                    />
                    {/* THE LESSON ITSELF, FIRST — not a list of files that add up to one.
                        Rory, on opening a finished module: "i wanted the full slidedeck at the
                        beginning of the lesson, in a window so you can immediately see it — press
                        play, the audio starts auto and moves through unless you stop the deck."
                        The 24-row track list that used to sit here was a filing cabinet: it made
                        the learner assemble the lesson themselves, one tap at a time, with no
                        picture. The deck opens on slide 1 and one tap plays the whole thing.

                        The audio-only player stays for a module that has narration but no slides,
                        so a half-produced module still gives a farmer everything it does have. */}
                    {hasDeck(mod.id) ? (
                      <div className="pt-3">
                        <DeckPlayer moduleId={mod.id} lang={lang} />
                      </div>
                    ) : hasNarration(mod.id) ? (
                      <div className="pt-3">
                        <CourseAudioPlayer
                          moduleId={mod.id}
                          appLang={lang}
                          tracks={allTracks(mod.id)}
                          label="Listen to the whole module"
                        />
                      </div>
                    ) : null}
                    <p className="font-display text-xs font-semibold uppercase tracking-wide pt-3 pb-1" style={{ color: '#8C7A62' }}>
                      Lessons
                    </p>
                    {mod.lessons.map((lesson) => (
                      <LessonPanel
                        key={lesson.id}
                        lesson={lesson}
                        color={color}
                        moduleId={mod.id}
                        lang={lang}
                        autoOpen={jumpToLessonId === lesson.id}
                        onJumpToLesson={jumpToLesson}
                      />
                    ))}
                  </div>
                )}

                {/* Submission entry point — only exists once real assignment content ships for
                    this module (see the LOUD COMMENT on MODULE_ASSIGNMENTS in
                    lib/course-gating.ts); degrades to nothing until then. */}
                {content && (
                  <div className="px-4 pb-4" style={{ borderTop: isExpanded ? 'none' : '1px solid #E2D8C4' }}>
                    <button
                      type="button"
                      onClick={() => setSubmissionOpenId((prev) => (prev === mod.id ? null : mod.id))}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 mt-3 rounded-xl transition-colors"
                      style={{ background: `${color}0C`, border: `1px solid ${color}25` }}
                    >
                      <ClipboardList size={13} style={{ color, flexShrink: 0 }} />
                      <span className="flex-1 text-left font-sans text-xs font-semibold" style={{ color }}>
                        {submission ? 'Submitted — tap to resubmit' : 'Submit this module'}
                      </span>
                      {submission && <CheckCircle size={13} style={{ color, flexShrink: 0 }} />}
                      {submissionOpen
                        ? <ChevronUp size={12} style={{ color, flexShrink: 0 }} />
                        : <ChevronDown size={12} style={{ color, flexShrink: 0 }} />}
                    </button>
                    {submissionOpen && (
                      <div className="mt-2">
                        <SubmissionPanel
                          moduleId={mod.id}
                          assignment={content}
                          color={color}
                          existing={submission}
                          onSubmitted={() => { setSubmissionOpenId(null); load(); }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Capstone — locked until every module is done + submitted; links to the EXISTING
            Design Studio (/design), not a new tool. The plan-set export there is the
            completion artifact. */}
        <div className="rounded-2xl px-5 py-5"
          style={{
            background: capstoneUnlocked ? 'rgba(31,77,43,0.06)' : '#FFFEFA',
            border: `1px solid ${capstoneUnlocked ? 'rgba(31,77,43,0.25)' : '#E2D8C4'}`,
          }}>
          <div className="flex items-center gap-2 mb-2">
            {capstoneUnlocked
              ? <Trophy size={16} style={{ color: '#1F4D2B', flexShrink: 0 }} />
              : <Lock size={14} style={{ color: '#8C7A62', flexShrink: 0 }} />}
            <span className="font-display font-semibold text-sm" style={{ color: capstoneUnlocked ? '#1F4D2B' : '#8C7A62' }}>
              Capstone: your farm design
            </span>
          </div>
          <p className="font-sans text-xs leading-relaxed mb-3" style={{ color: capstoneUnlocked ? '#3A3020' : '#8C7A62' }}>
            {capstoneUnlocked
              ? 'You have finished every module. Build your final design plan-set in the Design Studio — that is your completion artifact for the course.'
              : `Finish and submit all ${TOTAL_MODULES} modules to unlock your capstone design.`}
          </p>
          {capstoneUnlocked && (
            <Link href="/design"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-sans font-semibold text-sm transition-all"
              style={{ background: '#1F4D2B', color: '#F7F2E9', textDecoration: 'none' }}>
              Open Design Studio
            </Link>
          )}
        </div>

        {/* Completion banner */}
        {pct === 100 && (
          <div className="rounded-2xl px-5 py-5 text-center space-y-2"
            style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.2)' }}>
            <Sprout size={28} style={{ color: '#1F4D2B', margin: '0 auto' }} />
            <div className="font-display font-bold text-base" style={{ color: '#1F4D2B' }}>
              Course complete!
            </div>
            <p className="font-sans text-sm" style={{ color: '#5C5040' }}>
              {/* No push/SMS/email notification exists anywhere in this app — the mentor
                  dashboard only shows progress when a mentor opens it and looks. The old
                  wording ("Your trainer will be notified") promised an alert the code never
                  sends, which a farmer has no way to check up on. */}
              You have completed the full ImbewuField permaculture curriculum. If you have a
              mentor, they will see this progress next time they check in.
            </p>
          </div>
        )}

        {!isLive && (
          <p className="text-center text-xs font-mono" style={{ color: '#8C7A62' }}>
            Progress will save to Firebase once the backend is connected
          </p>
        )}
      </main>
      <TabBar />
    </div>
  );
}
