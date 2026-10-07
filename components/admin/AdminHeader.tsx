'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface SessionUser {
  userId?: string;
  email: string;
  name?: string;
  photoUrl?: string;
}

export function AdminHeader() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'Admin');
  const displayEmail = user?.email || '';
  const initial = (displayName || 'U').charAt(0).toUpperCase();

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/admin" className="font-bold text-lg tracking-tight text-black flex items-center gap-2">
            <span className="w-4 h-4 bg-black inline-block" aria-hidden="true" />
            <span>SignFlow</span>
          </Link>
          <nav className="flex space-x-4">
            <Link
              href="/admin"
              className="text-sm font-medium text-black hover:text-neutral-600 transition-colors"
            >
              Contracts
            </Link>
            <Link
              href="/admin/contracts/new"
              className="text-sm font-medium text-neutral-600 hover:text-black transition-colors"
            >
              New Contract
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          {user && (
            <div className="flex items-center space-x-2.5 text-right">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-black leading-tight max-w-[160px] truncate">
                  {displayName}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono leading-tight max-w-[160px] truncate">
                  {displayEmail}
                </span>
              </div>
              {user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoUrl}
                  alt={displayName}
                  className="w-8 h-8 rounded-full border border-neutral-300 object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-black text-white text-xs font-bold font-mono flex items-center justify-center shrink-0 border border-black"
                  aria-label={displayName}
                >
                  {initial}
                </div>
              )}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
