import { useState } from 'react';
import { downloadResume } from './api';

type Props = {
  accessToken: string;
  refreshToken: string;
  onRefresh: (token: string) => void;
};

const concepts = [
  ['Redis', 'Fast in-memory storage for OTPs, refresh tokens, rate limits and shared caching.'],
  ['Caching', 'Frequently requested resume data is reused instead of repeatedly reading from disk.'],
  ['Bloom Filter', 'A probabilistic structure that can quickly tell us whether something may exist before hitting a database.'],
  ['Hashing', 'Argon2id protects passwords while a secure fingerprint lets us detect reused passwords.'],
  ['Access Token', 'A short-lived credential used to access the protected resume API.'],
  ['Refresh Token', 'A longer-lived credential stored and controlled through Redis to renew access.'],
  ['Rate Limiting', 'Protects expensive authentication operations from abuse without blocking normal resume traffic.']
];

const flows = [
  {
    endpoint: 'POST /api/auth/login',
    title: 'Account + OTP Flow',
    description:
      'The first login can create the account. Existing users are authenticated, while new passwords are checked for reuse before being stored securely.',
    nodes: [
      ['Email + Password', 'User enters credentials from the React login screen.'],
      ['Validate Input', 'Fastify normalizes the email and checks the password requirements.'],
      ['Find User', 'PostgreSQL checks whether the email already exists.'],
      ['Existing User', 'Argon2id verifies the submitted password against the stored hash.'],
      ['New User', 'HMAC-SHA256 creates a deterministic password fingerprint.'],
      ['Password Unique?', 'PostgreSQL checks the unique fingerprint constraint to prevent password reuse.'],
      ['Store Securely', 'Argon2id hashes the password and PostgreSQL stores the hash + fingerprint.'],
      ['Generate OTP', 'Node crypto generates a six-digit OTP.'],
      ['Redis', 'OTP is stored with a five-minute expiration.'],
      ['Nodemailer → Email', 'Gmail SMTP sends the OTP to the email entered by the user.']
    ]
  },
  {
    endpoint: 'POST /api/auth/verify-otp',
    title: 'Verification + Token Flow',
    description:
      'The OTP proves control of the email address. After verification, the API creates the credentials required to access the protected resume endpoint.',
    nodes: [
      ['Email + OTP', 'React sends the entered OTP together with the email.'],
      ['Rate Limit', 'Redis limits failed verification attempts to reduce brute-force attacks.'],
      ['Redis Lookup', 'The API retrieves the OTP stored during the login flow.'],
      ['Compare OTP', 'The submitted code is checked against the stored value and expiry.'],
      ['Delete OTP', 'The OTP is removed from Redis after successful verification.'],
      ['Find User', 'PostgreSQL retrieves the authenticated user.'],
      ['Access Token', 'JWT creates a short-lived 15-minute access token.'],
      ['Refresh Token', 'JWT creates a longer-lived seven-day refresh token.'],
      ['Redis Session', 'The refresh token is stored in Redis so it can be checked and revoked.'],
      ['Dashboard', 'The client receives the tokens and enters the authenticated dashboard.']
    ]
  },
  {
    endpoint: 'GET /api/resume',
    title: 'High-Concurrency Resume Flow',
    description:
      'The protected endpoint is optimized for many users requesting the same file. The system checks the fastest cache first and avoids repeated disk reads.',
    nodes: [
      ['1000 Requests', 'Playwright can generate a large burst of legitimate authenticated requests.'],
      ['JWT Verification', 'Fastify verifies the short-lived access token before serving the file.'],
      ['Memory Cache', 'The fastest layer is checked first inside the running API process.'],
      ['Redis Cache', 'If memory misses, the shared Redis cache is checked.'],
      ['Cache Hit', 'A cached PDF can be returned without touching the filesystem.'],
      ['Cache Miss', 'Only the first request needs to read resume.pdf from disk.'],
      ['Single-Flight', 'Concurrent requests wait for the same file-loading Promise instead of creating 1000 disk reads.'],
      ['Populate Caches', 'The loaded PDF is placed into memory and Redis.'],
      ['PDF Response', 'All waiting authenticated requests receive the same cached resume data.']
    ]
  }
];

const technologies: string[][] = [
  ['React + Vite', 'Frontend', 'Provides the interactive login, OTP and dashboard UI with a minimal development setup.'],
  ['Fastify + TypeScript', 'API', 'Handles authentication and resume requests with a lightweight, strongly typed server.'],
  ['PostgreSQL + Drizzle', 'Database', 'Stores users, password hashes and deterministic password fingerprints with relational constraints.'],
  ['Redis + ioredis', 'Cache / State', 'Handles OTP expiry, refresh tokens, rate limiting and shared resume caching.'],
  ['Argon2id + HMAC-SHA256', 'Security', 'Argon2id protects passwords while HMAC fingerprints allow deterministic password-reuse detection.'],
  ['Nodemailer + Gmail SMTP', 'Email', "Delivers the one-time verification code to the user's entered email address."],
  ['Playwright', 'Load Testing', 'Generates concurrent API requests to test how the resume endpoint behaves under load.']
];

export default function Dashboard({
  accessToken,
  refreshToken,
  onRefresh
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState('Architecture');

  async function handleDownload() {
    setError('');
    setDownloading(true);

    try {
      await downloadResume(
        accessToken,
        refreshToken,
        onRefresh
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Download failed'
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="background-video fixed inset-[-8%] h-[116%] w-[116%] object-cover opacity-70"
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>

      <div className="fixed inset-0 bg-zinc-950/75" />
      <div className="fixed inset-0 bg-linear-to-b from-black/20 via-zinc-950/40 to-zinc-950" />

      <nav className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="font-semibold">Resume API</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600">
              System Design Demo
            </p>
          </div>

          <button
            className="rounded-xl border border-white/10 bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-zinc-200 disabled:opacity-50"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'Preparing...' : 'Download Resume'}
          </button>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-24 sm:pt-32">
        <div className="max-w-4xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Built as a practical system-design experiment
          </p>

          <h1 className="bg-linear-to-r from-white via-zinc-300 to-zinc-600 bg-clip-text text-6xl font-semibold leading-[0.92] tracking-[-0.06em] text-transparent sm:text-8xl">
            A resume API
            <br />
            designed to scale.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-400">
            This project turns a simple resume download into a practical
            demonstration of authentication, distributed caching,
            database design and concurrent API traffic.
          </p>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            ['1000+', 'Concurrent requests'],
            ['2', 'Cache layers'],
            ['3', 'Core API flows']
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/4 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/7"
            >
              <p className="text-4xl font-semibold tracking-tight">
                {value}
              </p>
              <p className="mt-2 text-sm text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-28">
          <div className="mb-10 flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {['Architecture', 'Concepts', 'Technology'].map(tab => (
              <button
                key={tab}
                onClick={() => setActive(tab)}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  active === tab
                    ? 'bg-white text-black'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {active === 'Architecture' && (
            <div>
              <div className="mb-10 max-w-3xl">
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-600">
                  How the system actually works
                </p>

                <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                  Three endpoints. Three complete flows.
                </h2>

                <p className="mt-4 leading-7 text-zinc-500">
                  Instead of treating the architecture as a list of
                  technologies, these flows show what actually happens to a
                  request from the moment it enters the API until the response
                  is returned.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {flows.map(flow => (
                  <article
                    key={flow.endpoint}
                    className="rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:border-white/20 hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        API FLOW
                      </span>

                      <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                        {flow.endpoint.split(' ')[0]}
                      </span>
                    </div>

                    <h3 className="mt-5 text-xl font-semibold">
                      {flow.title}
                    </h3>

                    <code className="mt-2 block text-xs text-zinc-500">
                      {flow.endpoint}
                    </code>

                    <p className="mt-5 text-sm leading-6 text-zinc-500">
                      {flow.description}
                    </p>

                    <div className="mt-7 space-y-0">
                      {flow.nodes.map(([title, text], index) => (
                        <div key={title} className="relative">
                          <div className="flex gap-3">
                            <div className="flex w-5 flex-col items-center">
                              <div className="relative z-10 mt-1 h-2.5 w-2.5 rounded-full border border-zinc-500 bg-zinc-900 transition group-hover:bg-white" />

                              {index !== flow.nodes.length - 1 && (
                                <div className="h-full min-h-8 w-px bg-white/10" />
                              )}
                            </div>

                            <div className="pb-5">
                              <p className="text-sm font-medium text-zinc-200">
                                {title}
                              </p>

                              <p className="mt-1 text-xs leading-5 text-zinc-600">
                                {text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-8 rounded-3xl border border-white/10 bg-black/25 p-7 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-600">
                  Why this architecture works
                </p>

                <div className="mt-5 grid gap-6 md:grid-cols-3">
                  <div>
                    <p className="font-medium text-zinc-200">
                      Security
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Passwords are protected with Argon2id, password reuse
                      is detected through an HMAC fingerprint, OTPs expire
                      through Redis, and resume access requires a JWT.
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-zinc-200">
                      Performance
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      The resume is served from memory when possible, Redis
                      provides a shared second layer, and concurrent cold
                      requests share one file-loading operation.
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-zinc-200">
                      Scalability
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Redis keeps temporary state and shared cache data
                      outside the API process, allowing the same architecture
                      to work across multiple server instances.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === 'Concepts' && (
            <div>
              <div className="mb-10 max-w-2xl">
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-600">
                  Why it matters
                </p>

                <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                  The ideas behind the API.
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {concepts.map(([title, text]) => (
                  <article
                    key={title}
                    className="group rounded-2xl border border-white/10 bg-black/20 p-7 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/6"
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <h3 className="text-xl font-medium">{title}</h3>

                      <span className="text-zinc-700 transition group-hover:text-zinc-400">
                        ↗
                      </span>
                    </div>

                    <p className="text-sm leading-7 text-zinc-500">
                      {text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {active === 'Technology' && (
            <div>
              <div className="mb-10 max-w-2xl">
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-600">
                  The stack
                </p>

                <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                  Every technology has a job.
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {technologies.map(([title, category, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/10 bg-white/3 p-7 transition hover:-translate-y-1 hover:bg-white/6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-xl font-medium">{title}</h3>

                      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                        {category}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-7 text-zinc-500">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <section className="mt-28 overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-8 backdrop-blur-xl sm:p-12">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-600">
            The main challenge
          </p>

          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            What happens when 1000 users request the same resume?
          </h2>

          <p className="mt-5 max-w-2xl leading-7 text-zinc-500">
            We don't solve load by rejecting most users. The goal is to
            serve legitimate authenticated traffic efficiently.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {[
              '1000 Requests',
              'JWT Verification',
              'Memory Cache',
              'Redis Cache',
              'Single-Flight',
              'Resume PDF'
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3"
              >
                <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                  <span className="text-xs text-zinc-700">
                    0{index + 1}
                  </span>

                  <span className="ml-3 text-sm text-zinc-300">
                    {item}
                  </span>
                </div>

                {index < 5 && (
                  <span className="text-zinc-700">→</span>
                )}
              </div>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-7 text-zinc-500">
            On a cold cache, one request reads the PDF while concurrent
            requests wait for that same operation. The resulting file is
            placed in memory and Redis, so later requests avoid the disk.
            This allows the test to measure actual throughput and latency
            instead of simply rejecting traffic with rate limiting.
          </p>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </section>

      <footer className="relative z-10 border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs text-zinc-600 sm:flex-row">
          <span>Resume API</span>

          <span>
            Authentication · Redis · Caching · PostgreSQL · System Design
          </span>
        </div>
      </footer>
    </main>
  );
}