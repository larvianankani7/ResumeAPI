import { useState } from 'react';
import { login, verifyOtp } from './api';
import Dashboard from './Dashboard';
import './App.css';

type Page = 'login' | 'otp' | 'dashboard';

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      setPage('otp');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Login failed'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    setLoading(true);

    try {
      const data = await verifyOtp(email, otp);

      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setPage('dashboard');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Invalid OTP'
      );
    } finally {
      setLoading(false);
    }
  }

  if (page === 'dashboard') {
    return (
      <Dashboard
        accessToken={accessToken}
        refreshToken={refreshToken}
        onRefresh={setAccessToken}
      />
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 py-10 text-white">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="background-video absolute inset-[-8%] h-[116%] w-[116%] object-cover opacity-70"
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-linear-to-br from-black/75 via-zinc-950/80 to-zinc-900/70" />
      <div className="absolute left-[10%] top-[15%] h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute bottom-[10%] right-[10%] h-80 w-80 rounded-full bg-zinc-400/10 blur-3xl" />

      <section className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-12">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Resume API
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-zinc-500">
              System Design Demo
            </p>
          </div>

          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
        </div>

        {page === 'login' ? (
          <>
            <div className="mb-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Secure access
              </p>

              <h1 className="text-5xl font-semibold tracking-tighter text-transparent bg-linear-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text sm:text-6xl">
                Your resume.
                <br />
                Built to scale.
              </h1>

              <p className="mt-6 max-w-md text-base leading-7 text-zinc-400">
                Explore a working system-design project demonstrating
                authentication, Redis, caching, PostgreSQL and API
                performance under load.
              </p>
            </div>

            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 focus:bg-black/30"
                type="email"
                placeholder="Your email"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />

              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 focus:bg-black/30"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />

              <button
                className="group mt-2 flex w-full items-center justify-between rounded-xl bg-white px-5 py-4 font-semibold text-black transition hover:-translate-y-0.5 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleLogin}
                disabled={loading || !email || !password}
              >
                <span>
                  {loading ? 'Sending OTP...' : 'Continue securely'}
                </span>
                <span className="transition group-hover:translate-x-1">
                  →
                </span>
              </button>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
              First login creates your account. Your password is never
              stored as plain text.
            </p>
          </>
        ) : (
          <>
            <div className="mb-8">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Email verification
              </p>

              <h1 className="text-5xl font-semibold tracking-tighter text-transparent bg-linear-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text">
                One last step.
              </h1>

              <p className="mt-5 leading-7 text-zinc-400">
                A six-digit verification code was sent to{' '}
                <span className="text-zinc-200">{email}</span>.
              </p>
            </div>

            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-5 text-center text-2xl tracking-[0.5em] text-white outline-none transition placeholder:text-sm placeholder:tracking-normal placeholder:text-zinc-600 focus:border-white/30"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter OTP"
              value={otp}
              onChange={event => setOtp(event.target.value)}
            />

            <button
              className="group mt-3 flex w-full items-center justify-between rounded-xl bg-white px-5 py-4 font-semibold text-black transition hover:-translate-y-0.5 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
            >
              <span>
                {loading ? 'Verifying...' : 'Enter dashboard'}
              </span>
              <span className="transition group-hover:translate-x-1">
                →
              </span>
            </button>
          </>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </section>
    </main>
  );
}