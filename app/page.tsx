import Link from 'next/link';
import { DocumentIcon, SignatureIcon, LockIcon } from '@/components/ui/Icons';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col justify-between">
      {/* Navigation */}
      <header className="border-b border-neutral-200 py-4 px-6 sm:px-12 flex justify-between items-center">
        <div className="flex items-center space-x-2 font-bold text-lg tracking-tight">
          <span className="w-4 h-4 bg-black" aria-hidden="true" />
          <span>SignFlow</span>
        </div>
        <Link
          href="/login"
          className="text-xs font-semibold px-3 py-2 border border-black hover:bg-black hover:text-white transition-colors"
        >
          Administrator Sign In
        </Link>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-16 sm:py-24 text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-block px-3 py-1 text-xs border border-neutral-300 font-mono text-neutral-600 uppercase tracking-widest">
            Production Document Finalization
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-black">
            Simple, focused online contract signing.
          </h1>
          <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Eliminate friction, confusion, and anxiety from agreements. SignFlow provides direct, secure signing links, responsive drawing and typing signatures, and immutable signed PDFs.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center font-medium bg-black text-white hover:bg-neutral-800 border border-black text-sm px-6 py-3.5 h-12 transition-colors"
          >
            Access Admin Console
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left border-t border-neutral-200">
          <div className="p-4 border border-neutral-200">
            <DocumentIcon className="w-5 h-5 text-black mb-2" />
            <h3 className="text-sm font-bold text-black">Document-First Reading</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Dedicated PDF canvas reading experience with zoom, fit-to-width, and mobile layout.
            </p>
          </div>
          <div className="p-4 border border-neutral-200">
            <SignatureIcon className="w-5 h-5 text-black mb-2" />
            <h3 className="text-sm font-bold text-black">Drawn & Typed Signatures</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Smooth HTML5 pointer canvas supporting finger, stylus, or mouse alongside verified typed signatures.
            </p>
          </div>
          <div className="p-4 border border-neutral-200">
            <LockIcon className="w-5 h-5 text-black mb-2" />
            <h3 className="text-sm font-bold text-black">Audit & Finalization</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Server-side atomic execution with SHA-256 document fingerprinting and Telegram / Resend notifications.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 px-6 text-center text-xs text-neutral-500">
        SignFlow Document Finalization Platform • Strictly Black & White Architecture
      </footer>
    </div>
  );
}
