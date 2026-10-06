'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function AdminHeader() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/admin" className="font-bold text-lg tracking-tight text-black flex items-center gap-2">
            <span className="w-4 h-4 bg-black inline-block" aria-hidden="true" />
            SignFlow
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

        <div className="flex items-center space-x-4">
          <span className="text-xs text-neutral-500 hidden sm:inline-block">Admin Console</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
