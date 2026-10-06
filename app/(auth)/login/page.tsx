'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { LockIcon, EyeIcon, EyeOffIcon } from '@/components/ui/Icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please verify your credentials.');
        setIsLoading(false);
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('A network error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-black text-white mb-4">
            <LockIcon className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black">SignFlow</h1>
          <p className="text-sm text-neutral-500 mt-1">Administrator Access</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your administrator credentials to access the console</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@signflow.app"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-neutral-500 hover:text-black focus-visible:outline-2 focus-visible:outline-black cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="p-3 border border-black bg-neutral-50 text-xs font-medium text-black" role="alert">
                <span className="font-bold underline mr-1">Error:</span>
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              loadingText="Signing in..."
            >
              SIGN IN
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
            <p className="text-xs text-neutral-500">
              Demo admin: <span className="font-mono text-black font-semibold">admin@signflow.app</span> / <span className="font-mono text-black font-semibold">AdminSignFlow2026!</span>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
