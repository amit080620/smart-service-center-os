'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Mail, ShieldAlert, Wrench, Users, Package, Receipt } from 'lucide-react';
import { createSupabaseBrowserClient } from '@smartbizos/database';
import { loginSchema, signupSchema } from '@smartbizos/validation';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details.');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password
    });

    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Incorrect email or password.' : signInError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsed = signupSchema.safeParse({
      orgName,
      ownerFullName: ownerName,
      email,
      password: signupPassword,
      contactPhone
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message ?? 'Could not create your account.');
      }

      // Signup only creates the account server-side — sign in right after,
      // the same as a returning user would, to get a real browser session.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password
      });
      if (signInError) throw signInError;

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong during signup.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 relative z-10">
        {/* Branding — ordered AFTER the form on mobile (order-2), since
            logging in is the actual job; marketing copy comes after. */}
        <div className="order-2 md:order-1 md:col-span-5 flex flex-col justify-center text-slate-100 space-y-6 pr-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl shadow-[0_0_20px_rgba(255,201,60,0.25)]">
              <Wrench className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight text-white leading-none">Smart Service Center OS</h1>
              <p className="text-xs font-mono text-amber-500 tracking-widest uppercase mt-1">BY THERAY</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-semibold font-display leading-snug tracking-tight text-slate-100">
              Service Center Management System
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Industrial workshop management software engineered for rapid job ticketing, real-time
              mechanics tracking, inventory auto-deductions, and automated GST billing.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="bg-slate-900 border border-slate-800 text-amber-500 p-1.5 rounded-lg mt-0.5">
                <Users className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">Multi-Role Support:</strong> Permission scopes matching
                technicians, managers, supervisors, and cashiers.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-slate-900 border border-slate-800 text-amber-500 p-1.5 rounded-lg mt-0.5">
                <Package className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">Inventory Tracking:</strong> Auto-depletion of spare parts
                catalogs upon job completions.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-slate-900 border border-slate-800 text-amber-500 p-1.5 rounded-lg mt-0.5">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">GST Invoice Suite:</strong> Compliant IGST/CGST invoice
                automation with sequential numbering.
              </p>
            </div>
          </div>
        </div>

        {/* Auth form — first on mobile (order-1) */}
        <div className="order-1 md:order-2 md:col-span-7 flex flex-col justify-center space-y-6">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">
              {mode === 'login' ? 'Employee Portal Access' : 'Register Your Service Center'}
            </h3>
            <p className="text-xs text-slate-400 mb-6 font-mono">
              {mode === 'login' ? 'SECURE TENANT GATEWAY' : 'START YOUR 14-DAY FREE TRIAL'}
            </p>

            {error && (
              <div className="mb-6 bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'login' ? (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Corporate Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@yourgarage.com"
                        required
                        disabled={loading}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Portal Password</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(255,201,60,0.15)] disabled:opacity-50 cursor-pointer mt-6"
                  >
                    {loading ? 'Authenticating...' : 'Enter Dashboard Console'}
                  </button>
                </form>
                <p className="text-center text-xs text-slate-500 mt-5">
                  New service center?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(null); }}
                    className="text-amber-500 hover:text-amber-400 font-semibold cursor-pointer"
                  >
                    Register your garage
                  </button>
                </p>
              </>
            ) : (
              <>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Garage / Service Center Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Speedy Motors Pune"
                      required
                      disabled={loading}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 px-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Your Full Name (Owner)</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Ravi Kulkarni"
                      required
                      disabled={loading}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 px-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Corporate Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@yourgarage.com"
                        required
                        disabled={loading}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Phone (optional)</label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98200 11223"
                      disabled={loading}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 px-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Choose a Password</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        minLength={8}
                        disabled={loading}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(255,201,60,0.15)] disabled:opacity-50 cursor-pointer mt-6"
                  >
                    {loading ? 'Creating Your Workspace...' : 'Start Free Trial'}
                  </button>
                </form>
                <p className="text-center text-xs text-slate-500 mt-5">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    className="text-amber-500 hover:text-amber-400 font-semibold cursor-pointer"
                  >
                    Log in
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
