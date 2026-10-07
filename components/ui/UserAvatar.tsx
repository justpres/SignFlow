'use client';

import React, { useState } from 'react';
import { getDiceBearAvatar } from '@/lib/avatar';

interface UserAvatarProps {
  name?: string;
  email?: string;
  photoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: 'notionists' | 'initials';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base',
};

export function UserAvatar({
  name,
  email,
  photoUrl,
  size = 'md',
  className = '',
  style = 'notionists',
}: UserAvatarProps) {
  const [hasImgError, setHasImgError] = useState(false);

  const seed = email || name || 'SignFlow';
  const dicebearUrl = getDiceBearAvatar(seed, style);
  const activeSrc = !hasImgError && photoUrl ? photoUrl : dicebearUrl;
  const displayName = name || email || 'User';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full border border-neutral-300 bg-neutral-100 overflow-hidden ${sizeClasses[size]} ${className}`}
      title={displayName}
      aria-label={displayName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSrc}
        alt={displayName}
        onError={() => setHasImgError(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
