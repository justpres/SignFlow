'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { LockIcon, EyeIcon, EyeOffIcon } from '@/components/ui/Icons';
import { Modal } from '@/components/ui/Modal';

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

const DEMO_GOOGLE_USERS = [
  {
    name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'Startup Founder',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  },
  {
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'Legal Counsel',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  },
  {
    name: 'Carol Danvers',
    email: 'carol@example.com',
    role: 'Enterprise Sales',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Dev Google Accounts Modal for testing multi-tenant accounts
  const [showGoogleDevModal, setShowGoogleDevModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');

  const loginWithGooglePayload = async (payload: {
    idToken?: string;
    email: string;
    name?: string;
    photoUrl?: string;
    googleId?: string;
  }) => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Google authentication failed.');
        setIsGoogleLoading(false);
        return;
      }

      setShowGoogleDevModal(false);
      router.push('/admin');
      router.refresh();
    } catch {
      setError('A network error occurred during Google sign-in. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    // If Firebase Auth is fully configured with a live project, attempt popup sign-in
    const hasLiveFirebaseKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'mock-api-key' &&
      !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith('mock-');

    if (hasLiveFirebaseKey) {
      try {
        const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
        const { clientAuth } = await import('@/lib/firebase/client');
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(clientAuth, provider);
        const token = await result.user.getIdToken();
        await loginWithGooglePayload({
          idToken: token,
          email: result.user.email || '',
          name: result.user.displayName || undefined,
          photoUrl: result.user.photoURL || undefined,
          googleId: result.user.uid,
        });
        return;
      } catch (err: unknown) {
        console.warn('Firebase popup sign-in bypassed or cancelled:', err);
      }
    }

    // In development or when running without cloud credentials, open Google account selector
    setIsGoogleLoading(false);
    setShowGoogleDevModal(true);
  };

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
        {/* SaaS Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-black text-white mb-3">
            <LockIcon className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-black">SignFlow SaaS</h1>
          <p className="text-sm text-neutral-500 mt-1">Contract signing made effortless</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in or create your account to create, manage, and dispatch contracts
            </CardDescription>
          </CardHeader>

          <div className="space-y-5">
            {/* High-Visibility Continue with Google Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                className="w-full h-11 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-black border-2 border-black font-semibold text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-sm hover:shadow focus-visible:outline-2 focus-visible:outline-black disabled:opacity-50"
              >
                <GoogleIcon className="w-5 h-5 shrink-0" />
                <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>

              <div className="mt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setShowGoogleDevModal(true)}
                  className="text-[11px] text-neutral-500 hover:text-black underline transition-colors cursor-pointer"
                >
                  Quick switch Google Accounts (Multi-Tenant Demo)
                </button>
              </div>
            </div>

            {/* Strict Monochrome Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink mx-4 text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
                Or Continue With Email
              </span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            {/* Email / Password Form */}
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
                SIGN IN WITH EMAIL
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-neutral-100 text-center">
              <p className="text-xs text-neutral-500">
                Demo admin: <span className="font-mono text-black font-semibold">admin@signflow.app</span> /{' '}
                <span className="font-mono text-black font-semibold">AdminSignFlow2026!</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Google Account Selector / Multi-Tenant Dev Modal */}
      <Modal
        isOpen={showGoogleDevModal}
        onClose={() => setShowGoogleDevModal(false)}
        title="Sign in with Google"
        maxWidth="md"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-neutral-600">
            Choose an account or create a new perspective account to test full multi-tenant contract isolation:
          </p>

          <div className="space-y-2">
            {DEMO_GOOGLE_USERS.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() =>
                  loginWithGooglePayload({
                    email: user.email,
                    name: user.name,
                    photoUrl: user.photoUrl,
                    googleId: `google_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`,
                  })
                }
                disabled={isGoogleLoading}
                className="w-full p-3 border border-neutral-200 hover:border-black bg-white hover:bg-neutral-50 flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.photoUrl}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover border border-neutral-300"
                  />
                  <div>
                    <div className="text-xs font-bold text-black group-hover:underline">{user.name}</div>
                    <div className="text-[11px] text-neutral-500 font-mono">{user.email}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-neutral-100 text-neutral-700 border border-neutral-200">
                  {user.role}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-neutral-200 space-y-2">
            <label className="block text-xs font-bold text-black uppercase tracking-wider">
              Or Sign In with Any Custom Google Email:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Full Name (optional)"
                value={customGoogleName}
                onChange={(e) => setCustomGoogleName(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-neutral-300 focus:border-black focus:outline-none"
              />
              <input
                type="email"
                placeholder="user@company.com"
                value={customGoogleEmail}
                onChange={(e) => setCustomGoogleEmail(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-neutral-300 focus:border-black focus:outline-none"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full mt-2"
              disabled={!customGoogleEmail.trim() || isGoogleLoading}
              isLoading={isGoogleLoading}
              onClick={() =>
                loginWithGooglePayload({
                  email: customGoogleEmail.trim(),
                  name: customGoogleName.trim() || undefined,
                  googleId: `google_custom_${Buffer.from(customGoogleEmail.trim()).toString('hex').slice(0, 10)}`,
                })
              }
            >
              CONTINUE WITH THIS GOOGLE ACCOUNT
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
