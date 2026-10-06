import React from 'react';
import { SigningFlow } from '@/components/signing/SigningFlow';

interface SignPageProps {
  params: Promise<{ token: string }>;
}

export default async function SignPage({ params }: SignPageProps) {
  const { token } = await params;
  return <SigningFlow token={token} />;
}
