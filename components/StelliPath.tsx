'use client';
import { Camera, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  STELLI_MILESTONES,
  STELLI_STATES,
  stelliPath,
  stelliWalker,
  type MemberGender,
  type StelliStateTag,
} from '@/lib/stellipath';
import MemberAvatar from './MemberAvatar';
import StelliPathScene, { stelliPathHeight } from './StelliPathScene';

const KIDS_PATH_STAGES: Record<StelliStateTag, { x: number; scale: number }> = {
  SbG: { x: 0.447, scale: 0.68 },
  sP2S: { x: 0.624, scale: 0.63 },
  AoS: { x: 0.857, scale: 0.58 },
};
const KIDS_STAGE_ORDER = Object.keys(KIDS_PATH_STAGES) as StelliStateTag[];

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
    tag: string;
    stellarFragments: number;
    avatarUrl?: string;
    gender: MemberGender;
    stelliState: StelliStateTag;
  };
  day: string;
  onProfile?: () => void;
}) {
  const kids = member.tag === 'StelliKids';
  const journey = kids ? null : stelliPath(day);
  const kidStage = KIDS_PATH_STAGES[member.stelliState];
  const state = STELLI_STATES[member.stelliState];
  const walker = stelliWalker(member.tag, member.gender);
  const avatar = (
    <MemberAvatar src={member.avatarUrl} label={member.nickname + '’s profile picture'} />
  );
  const x = journey ? 0.085 + 0.83 * journey.position : kidStage.x;
  const marker = {
    '--path-x': x * 100 + '%',
    '--path-y': stelliPathHeight(x) * 100 + '%',
    '--marker-scale': journey ? 1 - 0.42 * journey.position : kidStage.scale,
  } as CSSProperties;

  return (
    <section
      className={kids ? 'stellipath stellipath-kids' : 'stellipath'}
      aria-labelledby="stellipath-heading"
    >
      <div className="stellipath-stage">
        <header className="stellipath-header">
          <div className="stellipath-identity">
            {onProfile ? (
              <button
                type="button"
                className="stellipath-avatar-button"
                onClick={onProfile}
                aria-label={member.avatarUrl ? 'Change profile picture' : 'Add profile picture'}
              >
                {avatar}
                <span className="stellipath-camera">
                  <Camera size={15} aria-hidden="true" />
                </span>
              </button>
            ) : (
              <div className="stellipath-avatar-button">{avatar}</div>
            )}
            <div className="stellipath-profile-details">
              <h2 id="stellipath-heading">StelliPath</h2>
              <span className="stellipath-code">{member.churchNumber}</span>
              <strong>{member.nickname}</strong>
              <p className="stellipath-fragments">
                <span>Stellar Fragments Earned:</span>{' '}
                <b>{member.stellarFragments.toLocaleString('en-US')}</b>
              </p>
              {!walker && onProfile && (
                <button type="button" className="stellipath-figure-link" onClick={onProfile}>
                  Set gender for walking figure
                </button>
              )}
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
          aria-label={
            journey
              ? `Current phase ${journey.phase.phase} on ${deadlineFormat.format(new Date(day))}. ${member.stelliState}, ${state.label}.`
              : `StelliKids journey from Saved by Grace, through Stellified Permitted to Share, to Assured of Salvation. Current stage is ${member.stelliState}, ${state.label}.`
          }
        >
          <StelliPathScene />
          <div className="stellipath-phase-row" aria-hidden="true">
            {journey ? (
              STELLI_MILESTONES.map((item) => (
                <span key={item.key} className={item.key === journey.phase.key ? 'is-current' : ''}>
                  <b>{item.phase}</b>
                </span>
              ))
            ) : (
              <>
                <span />
                {KIDS_STAGE_ORDER.map((key) => (
                  <span
                    key={key}
                    data-stage={key}
                    className={key === member.stelliState ? 'is-current' : ''}
                  >
                    <span className="stellipath-kids-stage-label">
                      <b>{key}</b>
                      <small>{STELLI_STATES[key].label}</small>
                    </span>
                  </span>
                ))}
              </>
            )}
          </div>
          <div className="stellipath-marker" style={marker} aria-hidden="true">
            <span>{member.stelliState}</span>
            {walker ? (
              <img
                className="stellipath-walker"
                src={'/assets/stellipath/' + walker}
                width={192}
                height={320}
                alt=""
              />
            ) : (
              <Sparkles className="stellipath-neutral-marker" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
      {journey && (
        <ul className="stellipath-countdowns" aria-label="Milestone countdowns">
          {STELLI_MILESTONES.map((item) => (
            <li key={item.key} className={item.key === journey.phase.key ? 'is-current' : ''}>
              <strong>
                {journey.days[item.key].toLocaleString('en-US')}{' '}
                <span>{journey.days[item.key] === 1 ? 'day' : 'days'}</span>
              </strong>
              <div>
                <b>{item.title}</b>
                <time dateTime={item.deadline}>
                  {deadlineFormat.format(new Date(item.deadline))}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
