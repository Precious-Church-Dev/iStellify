'use client';
import { Camera } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import {
  STELLI_MILESTONES,
  STELLI_STATES,
  stelliPath,
  type MemberGender,
  type StelliStateTag,
} from '@/lib/stellipath';
import MemberAvatar from './MemberAvatar';
import StelliPathScene, { stelliPathHeight } from './StelliPathScene';

const memberShapes: Record<MemberGender, string> = {
  male: 'M48 3Q55 2 59 6L58 10Q60 13 59 15L62 20 58 22Q58 26 55 27L51 27 50 32Q57 36 58 46L58 54 65 64Q70 67 71 72L68 75 64 73 61 68 54 63 49 54 46 68Q54 76 58 91L64 112Q66 116 73 115L77 117Q76 121 67 121L59 120Q56 112 53 105L47 92 39 80Q36 93 28 101L16 114Q14 117 18 121L16 124Q10 123 6 119L5 115 19 98 25 88 28 73Q26 66 31 54L34 43 29 53 25 66 24 74 20 79 17 77 17 71 21 64 24 49Q26 38 36 33L43 30 44 25Q39 23 39 16 38 6 48 3Z',
  female:
    'M47 3Q55 1 59 7L58 11Q60 15 59 17L62 21 58 23Q58 26 54 27L50 27 50 32Q55 35 57 41Q62 48 55 54L56 57 64 65 69 67 72 72 70 76 66 74 62 70 54 65 49 56Q45 66 48 71 54 78 57 91L63 111Q65 115 71 115L76 117Q77 121 68 121L59 121 54 107 47 92 40 82Q37 94 28 103L16 115Q14 118 19 121L17 124 10 122 6 117 19 99 25 88 29 73Q28 66 34 56L36 48 30 54 26 66 24 74 20 78 17 76 18 71 21 65 24 53Q27 40 36 35L44 32 45 26Q40 24 39 20 37 30 30 33L31 28 26 32Q27 24 32 21 36 17 36 11 39 5 47 3Z',
  unspecified:
    'M49 3Q60 3 60 14L62 20 58 23Q58 28 52 28L50 32Q57 38 58 47L57 55 65 65Q70 67 72 72L69 76 65 73 61 69 54 64 49 54 46 68Q54 77 58 92L63 111Q65 116 72 115L77 117Q77 121 68 121L59 121 53 105 47 92 39 81Q37 92 29 101L16 115Q14 118 18 121L16 124Q10 123 6 118L5 115 19 98 25 88 29 72Q27 65 32 55L34 46 30 53 25 66 24 74 20 79 17 77 18 71 21 65 24 51Q27 39 36 34L43 31 45 27Q39 24 39 16 38 6 49 3Z',
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
  const silhouetteId = useId();
  const x = 0.085 + 0.83 * position;
  const marker = {
    '--path-x': x * 100 + '%',
    '--path-y': stelliPathHeight(x) * 100 + '%',
    '--marker-scale': 1 - 0.42 * position,
  } as CSSProperties;

  return (
    <section className="stellipath" aria-labelledby="stellipath-heading">
      <div className="stellipath-stage">
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
          <StelliPathScene />
          <div className="stellipath-phase-row" aria-hidden="true">
            {STELLI_MILESTONES.map((item) => (
              <span key={item.key} className={item.key === phase.key ? 'is-current' : ''}>
                <b>{item.phase}</b>
              </span>
            ))}
          </div>
          <div className="stellipath-marker" style={marker} aria-hidden="true">
            <span>{member.stelliState}</span>
            <svg viewBox="0 0 82 125" focusable="false" data-silhouette={member.gender}>
              <defs>
                <linearGradient
                  id={silhouetteId + '-fill'}
                  x2="1"
                  y2="1"
                  gradientUnits="objectBoundingBox"
                >
                  <stop stopColor="#cfa65c" />
                  <stop offset=".32" stopColor="#27364a" />
                  <stop offset=".7" stopColor="#112034" />
                  <stop offset="1" stopColor="#664b2d" />
                </linearGradient>
                <clipPath id={silhouetteId + '-shape'}>
                  <path d={memberShapes[member.gender]} />
                </clipPath>
              </defs>
              <path
                className="stellipath-figure-outline"
                d={memberShapes[member.gender]}
                fill={`url(#${silhouetteId}-fill)`}
              />
              <g className="stellipath-figure-shading" clipPath={`url(#${silhouetteId}-shape)`}>
                <path d="M25 57Q41 30 53 36M35 37Q38 51 28 65M40 45Q45 62 40 72L56 96 65 119M42 67Q35 89 27 98L12 115M33 52Q45 53 58 60M29 63Q42 66 54 76M32 79Q42 84 53 94M25 96l14 1M17 106l13 1" />
              </g>
            </svg>
          </div>
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
