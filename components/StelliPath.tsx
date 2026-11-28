'use client';
import { Camera } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  STELLI_MILESTONES,
  STELLI_STATES,
  stelliPath,
  type MemberGender,
  type StelliStateTag,
} from '@/lib/stellipath';
import MemberAvatar from './MemberAvatar';

const memberShapes: Record<MemberGender, string> = {
  male: 'M32 4c7 0 11 5 11 11l3 5-4 2c0 5-2 7-6 8l-1 5c6 3 10 9 12 17l6 13 10 8-3 5-14-8-8-14-2 15 5 15 8 18 11 4v5H45l-13-21-3-7-7 12-13 13 4 5-3 4-10-6 1-6 14-20 4-19-1-13-4 11-2 14-6 2V68l3-17c1-7 7-14 15-17l1-5c-5-3-7-8-7-13 0-7 6-12 14-12Z',
  female:
    'M31 4c8 0 13 5 13 12l3 5-4 2c-1 4-3 7-7 7l-1 5c5 3 7 7 9 14l7 15 10 9-3 5-14-9-7-14-1 13 6 16 7 20 11 4v5H45l-12-21-4-7-7 12-13 13 4 5-3 4-10-6 1-6 14-20 4-18 4-14-4-9-5 13-3 13-6 2 1-11 3-16c2-7 7-12 13-15l2-5c-4-2-6-5-7-8-2 4-5 6-9 6l3-8c0-10 7-16 20-16Z',
  unspecified:
    'M31 5a13 13 0 0 1 9 22l-4 3 1 5c5 3 8 8 10 16l6 13 10 9-3 5-14-9-8-14-2 15 5 15 8 19 11 4v5H45l-13-21-3-7-7 12-13 13 4 5-3 4-10-6 1-6 14-20 4-19-1-13-4 11-2 14-6 2V68l3-17c1-7 7-14 15-17l1-5a13 13 0 0 1 6-24Z',
};
const deadlineFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export default function StelliPath({
  member,
  day,
  onProfile,
}: {
  member: {
    churchNumber: string;
    nickname: string;
    avatarUrl?: string;
    gender: MemberGender;
    stelliState: StelliStateTag;
  };
  day: string;
  onProfile: () => void;
}) {
  const { phase, position, days } = stelliPath(day);
  const state = STELLI_STATES[member.stelliState];
  const marker = {
    '--path-x': 8 + 84 * position + '%',
    '--path-y': 85 - 0.58 * (8 + 84 * position) + '%',
  } as CSSProperties;

  return (
    <section className="stellipath" aria-labelledby="stellipath-heading">
      <header className="stellipath-header">
        <div className="stellipath-identity">
          <button
            className="stellipath-avatar-button"
            onClick={onProfile}
            aria-label={member.avatarUrl ? 'Change profile picture' : 'Add profile picture'}
          >
            <MemberAvatar src={member.avatarUrl} label={member.nickname + '’s profile picture'} />
            <span className="stellipath-camera">
              <Camera size={15} aria-hidden="true" />
            </span>
          </button>
          <div>
            <h2 id="stellipath-heading">StelliPath</h2>
            <span className="stellipath-code">{member.churchNumber}</span>
            <strong>{member.nickname}</strong>
          </div>
        </div>
        <div className="stellipath-status">
          <span>Current StelliState</span>
          <strong>
            <span aria-hidden="true">{state.symbol} </span>
            {member.stelliState}
          </strong>
          <small>{state.label}</small>
        </div>
      </header>
      <div
        className="stellipath-chart"
        role="img"
        aria-label={`Current phase ${phase.phase} on ${deadlineFormat.format(new Date(day))}. ${member.stelliState}, ${state.label}.`}
      >
        <div className="stellipath-ribbon" aria-hidden="true" />
        <div className="stellipath-phase-row" aria-hidden="true">
          {STELLI_MILESTONES.map((item) => (
            <span key={item.key} className={item.key === phase.key ? 'is-current' : ''}>
              {item.phase}
            </span>
          ))}
        </div>
        <div className="stellipath-marker" style={marker} aria-hidden="true">
          <span>{member.stelliState}</span>
          <svg viewBox="0 0 64 120" focusable="false">
            <path d={memberShapes[member.gender]} />
          </svg>
        </div>
      </div>
      <ul className="stellipath-countdowns" aria-label="Milestone countdowns">
        {STELLI_MILESTONES.map((item) => (
          <li key={item.key} className={item.key === phase.key ? 'is-current' : ''}>
            <strong>
              {days[item.key].toLocaleString('en-US')}{' '}
              <span>{days[item.key] === 1 ? 'day' : 'days'}</span>
            </strong>
            <div>
              <b>{item.title}</b>
              <time dateTime={item.deadline}>{deadlineFormat.format(new Date(item.deadline))}</time>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
