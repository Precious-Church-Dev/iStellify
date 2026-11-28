'use client';
import { UserRound } from 'lucide-react';
import { useState } from 'react';

export default function MemberAvatar({ src, label }: { src?: string; label: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <span className="member-avatar" role="img" aria-label={label}>
      {src && failedSrc !== src ? (
        <img src={src} alt="" onError={() => setFailedSrc(src)} />
      ) : (
        <UserRound aria-hidden="true" />
      )}
    </span>
  );
}
