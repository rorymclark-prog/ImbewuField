'use client';

import { MapPin, User } from 'lucide-react';
import type { Profile } from '@/lib/db/types';

const ROLE_LABEL: Record<string, string> = {
  farmer: 'Farmer',
  mentor: 'Mentor',
  student: 'Student',
  ngo: 'NGO Staff',
  funder: 'Funder',
  admin: 'Admin',
};

const ROLE_COLOR: Record<string, string> = {
  farmer: '#1F4D2B',
  mentor: '#235E86',
  student: '#C07A1E',
  ngo: '#6B35A0',
  funder: '#B83A18',
  admin: '#5C5040',
};

interface Props {
  people: Profile[];
  loading: boolean;
  currentUserId?: string;
  onOpenProfile: () => void;
}

/* ── Avatar: photo or coloured-circle initials ─────────────────────────── */
function Avatar({ person }: { person: Profile }) {
  const initial = (person.full_name ?? '?')[0]?.toUpperCase() ?? '?';
  const bg = ROLE_COLOR[person.role] ?? '#5C5040';

  if (person.photo_url) {
    return (
      <img
        src={person.photo_url}
        alt={person.full_name ?? 'Profile photo'}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: '1.5px solid #E2D8C4',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: bg,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1.5px solid rgba(255,255,255,0.15)',
      }}
    >
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
        {initial}
      </span>
    </div>
  );
}

/* ── Role chip ──────────────────────────────────────────────────────────── */
function RoleChip({ role }: { role: string }) {
  const color = ROLE_COLOR[role] ?? '#5C5040';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: 20,
        fontSize: 10.5,
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

/* ── Skeleton card ──────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: '#FFFEFA',
        border: '1px solid #E2D8C4',
      }}
    >
      <div
        className="animate-pulse"
        style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(226,216,196,0.5)', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="animate-pulse"
          style={{ height: 13, width: '55%', borderRadius: 6, background: 'rgba(226,216,196,0.5)', marginBottom: 7 }}
        />
        <div
          className="animate-pulse"
          style={{ height: 10, width: '35%', borderRadius: 6, background: 'rgba(226,216,196,0.5)', marginBottom: 6 }}
        />
        <div
          className="animate-pulse"
          style={{ height: 9, width: '75%', borderRadius: 6, background: 'rgba(226,216,196,0.5)' }}
        />
      </div>
    </div>
  );
}

/* ── Single person card ─────────────────────────────────────────────────── */
function PersonCard({
  person,
  isCurrentUser,
  onOpenProfile,
}: {
  person: Profile;
  isCurrentUser: boolean;
  onOpenProfile?: () => void;
}) {
  const bio = person.bio?.trim();

  return (
    <div
      onClick={isCurrentUser ? onOpenProfile : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: '#FFFEFA',
        border: `1px solid ${isCurrentUser ? 'rgba(31,77,43,0.3)' : '#E2D8C4'}`,
        cursor: isCurrentUser ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      <Avatar person={person} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13.5,
              color: '#20190F',
              lineHeight: 1.2,
            }}
          >
            {person.full_name ?? 'Unknown'}
          </span>
          {isCurrentUser && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                padding: '1px 6px',
                borderRadius: 20,
                background: '#1F4D2B',
                color: '#EAF3E2',
                letterSpacing: '0.02em',
              }}
            >
              You
            </span>
          )}
        </div>

        {/* Role chip + map pin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <RoleChip role={person.role} />
          {person.showOnMap && (
            <MapPin
              size={12}
              style={{ color: '#1F4D2B', flexShrink: 0 }}
              aria-label="Visible on map"
            />
          )}
        </div>

        {/* Bio snippet */}
        {bio && (
          <p
            style={{
              fontSize: 11,
              color: '#8C7A62',
              margin: '4px 0 0',
              lineHeight: 1.4,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {bio}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function PeoplePanel({ people, loading, currentUserId, onOpenProfile }: Props) {
  const currentUser = currentUserId ? people.find((p) => p.id === currentUserId) ?? null : null;
  const otherPeople = people.filter((p) => p.id !== currentUserId);

  /* Empty state */
  if (!loading && people.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'rgba(92,80,64,0.08)',
            border: '1px solid #E2D8C4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <User size={24} style={{ color: '#5C5040' }} />
        </div>
        <p
          style={{
            fontSize: 13,
            color: '#5C5040',
            lineHeight: 1.5,
            maxWidth: 260,
            margin: 0,
            fontFamily: 'var(--font-sans)',
          }}
        >
          No team members found. Invite colleagues to join your organisation.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Your profile action button ─────────────────────────────────── */}
      <button
        onClick={onOpenProfile}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '11px 14px',
          borderRadius: 12,
          background: 'rgba(31,77,43,0.06)',
          border: '1px solid rgba(31,77,43,0.22)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
      >
        {currentUser ? (
          <Avatar person={currentUser} />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#1F4D2B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <User size={20} style={{ color: '#EAF3E2' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13.5,
              color: '#1F4D2B',
              lineHeight: 1.2,
            }}
          >
            {currentUser?.full_name ?? 'Your profile'}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#5C5040',
              marginTop: 2,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {currentUser ? ROLE_LABEL[currentUser.role] ?? currentUser.role : 'Tap to view and edit'}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            padding: '4px 10px',
            borderRadius: 8,
            background: '#1F4D2B',
            color: '#EAF3E2',
            flexShrink: 0,
          }}
        >
          Edit profile
        </span>
      </button>

      {/* ── Project team header ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 2px 0',
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: '#5C5040',
          }}
        >
          Project team
        </span>
        {!loading && (
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-sans)',
              color: '#8C7A62',
            }}
          >
            {people.length} {people.length === 1 ? 'member' : 'members'}
          </span>
        )}
      </div>

      {/* ── List (skeleton or real cards) ─────────────────────────────── */}
      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        <>
          {/* Current user first if present */}
          {currentUser && (
            <PersonCard
              person={currentUser}
              isCurrentUser
              onOpenProfile={onOpenProfile}
            />
          )}
          {otherPeople.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              isCurrentUser={false}
            />
          ))}
        </>
      )}
    </div>
  );
}
