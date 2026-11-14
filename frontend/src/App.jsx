import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Target,
  Trash2,
  Upload,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'My Resume', icon: FileText },
  { name: 'Job Matches', icon: BriefcaseBusiness },
  { name: 'Skill Analysis', icon: Target },
  { name: 'Learning Roadmap', icon: BookOpen },
  { name: 'Applications', icon: CheckCircle2 },
]

const applicationStatuses = ['Applied', 'Interview', 'Offer', 'Rejected']
const buttonPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60'
const buttonSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'

async function request(path, { token, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(payload?.error || 'The request could not be completed.')
  return payload
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('skillsync_token') || '')
  const [user, setUser] = useState(null)
  const [active, setActive] = useState('Dashboard')
  const [authMode, setAuthMode] = useState('login')
  const [dashboard, setDashboard] = useState({ profile: null, jobs: [], applications: [], completedSkills: [] })
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('skillsync_token')))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [search, setSearch] = useState('')
  const [noteDrafts, setNoteDrafts] = useState({})

  const selectedJob = useMemo(
    () => dashboard.jobs.find((job) => job.id === selectedJobId) || dashboard.jobs[0] || null,
    [dashboard.jobs, selectedJobId],
  )

  useEffect(() => {
    if (!token) return undefined

    let activeEffect = true
    Promise.all([
      request('/api/auth/me', { token }),
      request('/api/dashboard', { token }),
    ]).then(([account, data]) => {
      if (!activeEffect) return
      setUser(account.user)
      setDashboard(data)
      setSelectedJobId((current) => current || data.jobs[0]?.id || '')
      setError('')
    }).catch((loadError) => {
      if (!activeEffect) return
      setError(loadError.message)
      if (loadError.message.toLowerCase().includes('session')) {
        localStorage.removeItem('skillsync_token')
        setToken('')
        setUser(null)
      }
    }).finally(() => {
      if (activeEffect) setLoading(false)
    })

    return () => {
      activeEffect = false
    }
  }, [token])

  function signOut() {
    localStorage.removeItem('skillsync_token')
    setToken('')
    setUser(null)
    setLoading(false)
    setDashboard({ profile: null, jobs: [], applications: [], completedSkills: [] })
    setActive('Dashboard')
  }

  async function refreshDashboard() {
    const data = await request('/api/dashboard', { token })
    setDashboard(data)
    setSelectedJobId((current) => current || data.jobs[0]?.id || '')
  }

  async function handleAuth(event) {
    event.preventDefault()
    setBusy(true)
    setLoading(true)
    setError('')
    const fields = new FormData(event.currentTarget)
    const body = Object.fromEntries(fields.entries())
    try {
      const result = await request(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      localStorage.setItem('skillsync_token', result.token)
      setUser(result.user)
      setToken(result.token)
    } catch (authError) {
      setError(authError.message)
      setLoading(false)
    } finally {
      setBusy(false)
    }
  }

  async function handleResumeUpload(file) {
    if (!file) return
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file to analyze.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The resume must be 5 MB or smaller.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    const form = new FormData()
    form.append('resume', file)
    try {
      await request('/api/resume/analyze', { method: 'POST', body: form, token })
      await refreshDashboard()
      setNotice('Resume analyzed. Your job matches and learning roadmap are ready.')
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setBusy(false)
    }
  }

  async function addApplication(job) {
    setBusy(true)
    setError('')
    try {
      await request('/api/applications', {
        method: 'POST',
        token,
        body: JSON.stringify({ jobId: job.id }),
      })
      await refreshDashboard()
      setActive('Applications')
      setNotice(`${job.title} added to your application tracker.`)
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function updateApplication(application, changes) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/applications/${application.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(changes),
      })
      await refreshDashboard()
      setNotice('Application updated.')
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteApplication(application) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/applications/${application.id}`, { method: 'DELETE', token })
      await refreshDashboard()
      setNotice('Application removed from your tracker.')
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleProgress(skill, completed) {
    setBusy(true)
    setError('')
    try {
      await request(`/api/progress/${encodeURIComponent(skill)}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ completed: !completed }),
      })
      await refreshDashboard()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthScreen
        mode={authMode}
        busy={busy}
        error={error}
        onSubmit={handleAuth}
        onModeChange={(mode) => {
          setAuthMode(mode)
          setError('')
        }}
      />
    )
  }

  const profile = dashboard.profile
  const jobs = dashboard.jobs
  const matchingJobs = jobs.filter((job) => (
    `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(search.toLowerCase())
  ))
  const completedRoadmap = selectedJob?.roadmap.filter((step) => step.completed).length || 0
  const totalRoadmap = selectedJob?.roadmap.length || 0
  const averageMatch = jobs.length
    ? Math.round(jobs.reduce((sum, job) => sum + job.match_percentage, 0) / jobs.length)
    : 0

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <aside className="sidebar fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-7 md:flex">
        <a className="mb-1 flex items-center gap-3 px-2 text-xl font-bold tracking-tight text-slate-900" href="#">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">S</span>
          SkillSync<span className="text-indigo-600">.</span>
        </a>
        <p className="mb-10 pl-14 text-[10px] font-semibold tracking-[.19em] text-slate-400">YOUR CAREER COMPANION</p>
        <p className="mb-3 px-3 text-[10px] font-bold tracking-[.16em] text-slate-400">WORKSPACE</p>
        <nav className="space-y-1">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                active === name ? 'bg-indigo-50 font-semibold text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />{name}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-indigo-50 p-4">
          <p className="text-sm font-semibold text-indigo-950">Small steps, real progress.</p>
          <p className="mt-1 text-xs leading-5 text-indigo-700">Turn your next skill gap into a plan you can follow.</p>
        </div>
      </aside>

      <main className="min-h-screen md:ml-64">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur md:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">YOUR CAREER WORKSPACE</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight">{active}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-semibold">{user?.name}</span>
                <span className="block text-xs text-slate-400">{user?.email}</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                {user?.name?.slice(0, 1).toUpperCase() || 'S'}
              </span>
              <button onClick={signOut} className={buttonSecondary} aria-label="Sign out" title="Sign out">
                <LogOut size={16} /><span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
          <nav className="mt-4 flex gap-1 overflow-x-auto md:hidden">
            {navigation.map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => setActive(name)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                  active === name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'
                }`}
              >
                <Icon size={15} />{name}
              </button>
            ))}
          </nav>
        </header>

        <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 md:px-10 md:py-9">
          {error && <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert>}
          {notice && <Alert tone="success" onDismiss={() => setNotice('')}>{notice}</Alert>}

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading your workspace…</div>
          ) : (
            <>
              {active === 'Dashboard' && (
                <Dashboard
                  user={user}
                  profile={profile}
                  jobs={jobs}
                  applications={dashboard.applications}
                  averageMatch={averageMatch}
                  onNavigate={setActive}
                  onUpload={handleResumeUpload}
                  onSelectJob={(job) => {
                    setSelectedJobId(job.id)
                    setActive('Skill Analysis')
                  }}
                  busy={busy}
                />
              )}
              {active === 'My Resume' && (
                <ResumePanel profile={profile} busy={busy} onUpload={handleResumeUpload} />
              )}
              {active === 'Job Matches' && (
                <JobMatches
                  jobs={matchingJobs}
                  search={search}
                  setSearch={setSearch}
                  trackedIds={new Set(dashboard.applications.map((application) => application.jobId))}
                  busy={busy}
                  onSelectJob={(job) => {
                    setSelectedJobId(job.id)
                    setActive('Skill Analysis')
                  }}
                  onAddApplication={addApplication}
                />
              )}
              {active === 'Skill Analysis' && (
                <SkillAnalysis
                  jobs={jobs}
                  selectedJob={selectedJob}
                  onSelectJob={setSelectedJobId}
                  onNavigate={setActive}
                />
              )}
              {active === 'Learning Roadmap' && (
                <Roadmap
                  jobs={jobs}
                  selectedJob={selectedJob}
                  completedCount={completedRoadmap}
                  totalCount={totalRoadmap}
                  busy={busy}
                  onSelectJob={setSelectedJobId}
                  onToggleProgress={toggleProgress}
                />
              )}
              {active === 'Applications' && (
                <Applications
                  applications={dashboard.applications}
                  noteDrafts={noteDrafts}
                  setNoteDrafts={setNoteDrafts}
                  busy={busy}
                  onUpdate={updateApplication}
                  onDelete={deleteApplication}
                  onExplore={() => setActive('Job Matches')}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function AuthScreen({ mode, busy, error, onSubmit, onModeChange }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:grid-cols-2">
        <section className="flex flex-col justify-between bg-indigo-700 p-8 text-white md:p-12">
          <div>
            <span className="flex items-center gap-3 text-xl font-bold">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">S</span>
              SkillSync<span className="text-indigo-200">.</span>
            </span>
            <p className="mt-16 text-xs font-bold tracking-[.2em] text-indigo-200">YOUR NEXT CHAPTER STARTS HERE</p>
            <h1 className="mt-4 max-w-sm text-4xl font-bold leading-tight tracking-tight">Make your next career move with clarity.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-indigo-100">Understand your strengths, find roles that fit, and turn skill gaps into a learning plan.</p>
          </div>
          <p className="mt-16 text-xs text-indigo-200">A practical workspace for your career journey.</p>
        </section>
        <section className="p-8 md:p-12">
          <h2 className="text-2xl font-bold">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-2 text-sm text-slate-500">{mode === 'register' ? 'Start building a more focused career plan.' : 'Sign in to pick up where you left off.'}</p>
          {error && <Alert tone="error" className="mt-6">{error}</Alert>}
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {mode === 'register' && (
              <label className="block text-sm font-semibold text-slate-700">
                Full name
                <input name="name" required minLength="2" maxLength="80" autoComplete="name" className="form-input mt-2" placeholder="Jordan Lee" />
              </label>
            )}
            <label className="block text-sm font-semibold text-slate-700">
              Email address
              <input name="email" type="email" required autoComplete="email" className="form-input mt-2" placeholder="you@example.com" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input name="password" type="password" required minLength="8" maxLength="128" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className="form-input mt-2" placeholder="At least 8 characters" />
            </label>
            <button className={`${buttonPrimary} w-full py-3`} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'register' ? 'Already have an account?' : 'New to SkillSync?'}{' '}
            <button className="font-semibold text-indigo-600 hover:text-indigo-700" onClick={() => onModeChange(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </section>
      </div>
    </main>
  )
}

function Dashboard({ user, profile, jobs, applications, averageMatch, onNavigate, onUpload, onSelectJob, busy }) {
  const topJob = jobs[0]
  return (
    <>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-7 text-white md:p-10">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[.18em] text-indigo-200">YOUR CAREER JOURNEY, IN FOCUS</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl">Good to see you, {user?.name?.split(' ')[0]}.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">Discover the roles that fit your skills, spot what to learn next, and keep every application in one place.</p>
            <button onClick={() => onNavigate(profile ? 'Job Matches' : 'My Resume')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50">
              {profile ? 'Explore your job matches' : 'Analyze your resume'}<ArrowUpRight size={17} />
            </button>
          </div>
          <div className="hidden h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-white/10 md:flex">
            <Target size={66} strokeWidth={1.2} className="text-indigo-100" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Best job match" value={profile ? `${topJob?.match_percentage ?? 0}%` : '—'} detail={profile ? topJob?.title || 'No matches yet' : 'Upload your resume to begin'} icon={Target} />
        <StatCard label="Opportunities" value={profile ? jobs.length : '—'} detail="Roles ranked by skill fit" icon={BriefcaseBusiness} />
        <StatCard label="Skills identified" value={profile ? profile.skills.length : '—'} detail={profile ? `${profile.technical_skills.length} technical · ${profile.soft_skills.length} soft` : 'Extracted from your resume'} icon={FileText} />
        <StatCard label="Applications" value={applications.length} detail="Tracked in your workspace" icon={CheckCircle2} />
      </section>

      {!profile && (
        <section className="rounded-2xl border border-dashed border-indigo-300 bg-white p-7 text-center">
          <Upload className="mx-auto text-indigo-600" size={30} />
          <h3 className="mt-3 font-bold">Start with your resume</h3>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Upload a text-based PDF to identify skills and generate personalized job matches. Your file is processed locally by this project and is not retained.</p>
          <ResumeUpload busy={busy} onUpload={onUpload} compact />
        </section>
      )}

      {profile && (
        <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="font-bold">Top job matches</h3><p className="mt-1 text-xs text-slate-500">Opportunities ranked by your current skills</p></div>
              <button onClick={() => onNavigate('Job Matches')} className="text-xs font-semibold text-indigo-600">View all <ArrowUpRight className="inline" size={14} /></button>
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {jobs.slice(0, 3).map((job) => (
                <button key={job.id} onClick={() => onSelectJob(job)} className="flex w-full items-center gap-4 py-4 text-left first:pt-1 hover:bg-slate-50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">{job.company.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{job.title}</span><span className="mt-1 block text-xs text-slate-500">{job.company} · {job.location}</span></span>
                  <span className="text-sm font-bold text-indigo-700">{job.match_percentage}%</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div><h3 className="font-bold">Your next steps</h3><p className="mt-1 text-xs text-slate-500">Keep momentum with small actions</p></div>
              <BookOpen className="text-indigo-500" size={20} />
            </div>
            <div className="mt-5 space-y-4">
              <NextStep done={Boolean(profile)} label="Analyze your resume" onClick={() => onNavigate('My Resume')} />
              <NextStep done={false} label="Review a role's skill gaps" onClick={() => onNavigate('Skill Analysis')} />
              <NextStep done={applications.length > 0} label="Track an application" onClick={() => onNavigate('Applications')} />
              <NextStep done={averageMatch > 80} label="Build a learning habit" onClick={() => onNavigate('Learning Roadmap')} />
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-bold">Recent applications</h3>
          {applications.length ? (
            <div className="mt-4 space-y-3">
              {applications.slice(0, 3).map((application) => <ApplicationSummary key={application.id} application={application} />)}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-slate-50 p-5 text-center">
              <p className="text-sm text-slate-500">Your application tracker is ready when you are.</p>
              <button onClick={() => onNavigate('Job Matches')} className="mt-3 text-sm font-semibold text-indigo-600">Explore jobs</button>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between"><div><h3 className="font-bold">Learning progress</h3><p className="mt-1 text-xs text-slate-500">Choose a role to focus your roadmap</p></div><BookOpen className="text-indigo-500" size={20} /></div>
          {profile && topJob ? (
            <div className="mt-5">
              <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{topJob.title}</span><span className="text-slate-500">{topJob.roadmap.filter((step) => step.completed).length}/{topJob.roadmap.length} skills</span></div>
              <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${topJob.roadmap.length ? (topJob.roadmap.filter((step) => step.completed).length / topJob.roadmap.length) * 100 : 100}%` }} /></div>
              <button onClick={() => onNavigate('Learning Roadmap')} className="mt-4 text-sm font-semibold text-indigo-600">Continue your roadmap <ArrowUpRight className="inline" size={15} /></button>
            </div>
          ) : <p className="mt-5 text-sm text-slate-500">Analyze your resume to create a learning roadmap.</p>}
        </div>
      </section>
    </>
  )
}

function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">{label}</p><Icon size={19} className="text-indigo-500" /></div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-400">{detail}</p>
    </div>
  )
}

function NextStep({ done, label, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 text-left text-sm text-slate-600 hover:text-indigo-700">
      {done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : <Circle size={18} className="shrink-0 text-slate-300" />}
      {label}<ArrowUpRight className="ml-auto text-slate-300" size={15} />
    </button>
  )
}

function ResumeUpload({ busy, onUpload, compact = false }) {
  return (
    <label className={`mx-auto mt-5 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-indigo-200 text-center transition hover:bg-indigo-50 ${compact ? 'max-w-md p-5' : 'p-9'}`}>
      <Upload className="text-indigo-600" size={compact ? 22 : 30} />
      <span className="mt-2 text-sm font-semibold text-slate-800">{busy ? 'Analyzing your resume…' : 'Choose a PDF resume'}</span>
      <span className="mt-1 text-xs text-slate-400">Maximum 5 MB · text-based PDFs</span>
      <input
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          onUpload(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </label>
  )
}

function ResumePanel({ profile, busy, onUpload }) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><FileText size={23} /></span>
          <div><h2 className="text-lg font-bold">Resume analyzer</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Upload a PDF and SkillSync will extract contact details and identify technical and soft skills. You can replace your resume any time.</p></div>
        </div>
        <ResumeUpload busy={busy} onUpload={onUpload} />
      </div>
      {profile && (
        <>
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
            <div><p className="font-semibold text-emerald-800">Resume analyzed</p><p className="mt-1 text-xs text-emerald-700">{profile.filename} · {new Date(profile.analyzedAt).toLocaleString()}</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">{profile.skills.length} skills found</span>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <SkillList title="Technical skills" skills={profile.technical_skills} empty="No technical skills detected. Try a text-based PDF with a skills section." />
            <SkillList title="People & delivery skills" skills={profile.soft_skills} empty="No soft skills detected yet." />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="font-bold">Extracted contact details</h3>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-medium text-slate-400">Name</dt><dd className="mt-1 font-medium">{profile.name || 'Not detected'}</dd></div>
              <div><dt className="text-xs font-medium text-slate-400">Email</dt><dd className="mt-1 font-medium">{profile.email || 'Not detected'}</dd></div>
            </dl>
          </div>
          <details className="rounded-2xl border border-slate-200 bg-white p-6">
            <summary className="cursor-pointer text-sm font-semibold">Review extracted resume text</summary>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">{profile.extracted_text}</pre>
          </details>
        </>
      )}
    </section>
  )
}

function SkillList({ title, skills, empty }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-bold">{title} <span className="ml-1 text-xs font-medium text-slate-400">{skills?.length || 0}</span></h3>
      {skills?.length ? <div className="mt-4 flex flex-wrap gap-2">{skills.map((skill) => <span key={skill} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">{skill}</span>)}</div> : <p className="mt-3 text-sm text-slate-500">{empty}</p>}
    </div>
  )
}

function JobMatches({ jobs, search, setSearch, trackedIds, busy, onSelectJob, onAddApplication }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h2 className="text-xl font-bold">Opportunities for you</h2><p className="mt-1 text-sm text-slate-500">Compare your skills against role requirements and track the ones you pursue.</p></div>
        <label className="relative block sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-input pl-9" placeholder="Search roles or companies" /></label>
      </div>
      {!jobs.length ? <EmptyState title="No jobs found" detail="Try another search, or analyze a resume to get started." /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {jobs.map((job) => (
            <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">{job.company.slice(0, 1)}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{job.title}</h3><p className="mt-1 text-xs text-slate-500">{job.company} · {job.location} · {job.type}</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{job.match_percentage}% match</span></div></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{job.description}</p>
              <div className="mt-4 flex items-center justify-between text-xs"><span className="font-medium text-slate-500">Skill compatibility</span><span className="font-semibold text-slate-700">{job.matched_skills.length}/{job.required_skills.length} skills</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${job.match_percentage}%` }} /></div>
              <div className="mt-4 flex flex-wrap gap-1.5">{job.matched_skills.slice(0, 4).map((skill) => <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700" key={skill}>{skill}</span>)}{job.missing_skills.slice(0, 3).map((skill) => <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700" key={skill}>Learn: {skill}</span>)}</div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => onSelectJob(job)} className={buttonSecondary}>View skill gaps <ArrowUpRight size={15} /></button>
                <button disabled={busy || trackedIds.has(job.id)} onClick={() => onAddApplication(job)} className={buttonPrimary}>
                  {trackedIds.has(job.id) ? <><Check size={15} /> In tracker</> : <><Plus size={15} /> Track application</>}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SkillAnalysis({ jobs, selectedJob, onSelectJob, onNavigate }) {
  if (!selectedJob) return <EmptyState title="Analyze a role's skill gaps" detail="Upload a resume to compare your skills with available roles." action="Go to my resume" onAction={() => onNavigate('My Resume')} />
  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h2 className="text-xl font-bold">Skill gap analysis</h2><p className="mt-1 text-sm text-slate-500">See exactly where your experience aligns with a target role.</p></div>
        <label className="text-xs font-semibold text-slate-500">TARGET ROLE
          <select value={selectedJob.id} onChange={(event) => onSelectJob(event.target.value)} className="form-input mt-1 min-w-56">
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{selectedJob.company}</span><h3 className="mt-1 text-2xl font-bold">{selectedJob.title}</h3><p className="mt-1 text-sm text-slate-500">{selectedJob.location} · {selectedJob.type}</p></div>
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-[7px] border-indigo-100 text-indigo-700"><span className="text-2xl font-bold">{selectedJob.match_percentage}%</span><span className="text-[10px] font-medium">MATCH</span></div>
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600">{selectedJob.description}</p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <SkillList title="Skills you already have" skills={selectedJob.matched_skills} empty="No required skills matched yet. Build a plan below." />
          <SkillList title="Skills to develop" skills={selectedJob.missing_skills} empty="Great work — all skills for this role are covered." />
        </div>
        <button onClick={() => onNavigate('Learning Roadmap')} className={`${buttonPrimary} mt-6`}><BookOpen size={16} /> Build a learning roadmap</button>
      </div>
    </section>
  )
}

function Roadmap({ jobs, selectedJob, completedCount, totalCount, busy, onSelectJob, onToggleProgress }) {
  if (!selectedJob) return <EmptyState title="Your roadmap starts with a resume" detail="Upload a resume to find personalized learning topics for a role." />
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 100
  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h2 className="text-xl font-bold">Your learning roadmap</h2><p className="mt-1 text-sm text-slate-500">A focused plan built from the skills this role asks for.</p></div>
        <label className="text-xs font-semibold text-slate-500">TARGET ROLE
          <select value={selectedJob.id} onChange={(event) => onSelectJob(event.target.value)} className="form-input mt-1 min-w-56">
            {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{selectedJob.title}</p><h3 className="mt-2 text-xl font-bold">Your next skills, one step at a time</h3><p className="mt-1 text-sm text-slate-500">{totalCount ? `${totalCount} learning goals based on your current skill gaps` : 'No skill gaps for this role. Keep your skills fresh.'}</p></div>
          <span className="text-2xl font-bold text-indigo-700">{progress}%</span>
        </div>
        <div className="mt-5 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} /></div>
        <div className="mt-7 space-y-3">
          {selectedJob.roadmap.length ? selectedJob.roadmap.map((step, index) => (
            <button key={step.skill} disabled={busy} onClick={() => onToggleProgress(step.skill, step.completed)} className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${step.completed ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40'}`}>
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${step.completed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{step.completed ? <Check size={15} /> : index + 1}</span>
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">{step.skill}<span className={`rounded-full px-2 py-0.5 text-[10px] ${step.priority === 'High' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{step.priority} priority</span></span><span className="mt-1 block text-xs leading-5 text-slate-500">{step.title}</span></span>
              <span className="mt-1 text-xs font-semibold text-indigo-600">{step.completed ? 'Mark active' : 'Mark done'}</span>
            </button>
          )) : <div className="rounded-xl bg-emerald-50 p-5 text-center text-sm font-medium text-emerald-700">You have covered every required skill for this role. Nice work!</div>}
        </div>
      </div>
    </section>
  )
}

function Applications({ applications, noteDrafts, setNoteDrafts, busy, onUpdate, onDelete, onExplore }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h2 className="text-xl font-bold">Application tracker</h2><p className="mt-1 text-sm text-slate-500">Keep your opportunity pipeline and follow-up notes up to date.</p></div>
        <button onClick={onExplore} className={buttonPrimary}><Plus size={16} /> Add an opportunity</button>
      </div>
      {!applications.length ? <EmptyState title="No applications yet" detail="Save a role from your job matches to start tracking your progress." action="Explore job matches" onAction={onExplore} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {applications.map((application) => (
            <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">{application.job?.company.slice(0, 1) || 'J'}</span><div><h3 className="font-bold">{application.job?.title || 'Job opportunity'}</h3><p className="mt-1 text-xs text-slate-500">{application.job?.company} · Added {new Date(application.createdAt).toLocaleDateString()}</p></div></div>
                <button disabled={busy} onClick={() => onDelete(application)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${application.job?.title || 'application'}`}><Trash2 size={16} /></button>
              </div>
              <label className="mt-5 block text-xs font-semibold text-slate-500">APPLICATION STATUS
                <select disabled={busy} value={application.status} onChange={(event) => onUpdate(application, { status: event.target.value })} className="form-input mt-1">
                  {applicationStatuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="mt-4 block text-xs font-semibold text-slate-500">FOLLOW-UP NOTES
                <textarea
                  rows="2"
                  maxLength="1000"
                  value={noteDrafts[application.id] ?? application.notes}
                  onChange={(event) => setNoteDrafts((drafts) => ({ ...drafts, [application.id]: event.target.value }))}
                  className="form-input mt-1 resize-y"
                  placeholder="Add a reminder or interview note…"
                />
              </label>
              <button disabled={busy || (noteDrafts[application.id] ?? application.notes) === application.notes} onClick={() => onUpdate(application, { notes: noteDrafts[application.id] ?? '' })} className={`${buttonSecondary} mt-3`}>Save notes</button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ApplicationSummary({ application }) {
  const tone = {
    Applied: 'bg-blue-50 text-blue-700',
    Interview: 'bg-amber-50 text-amber-700',
    Offer: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-slate-100 text-slate-600',
  }[application.status]
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
      <div><p className="text-sm font-semibold">{application.job?.title || 'Job opportunity'}</p><p className="mt-1 text-xs text-slate-500">{application.job?.company}</p></div>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{application.status}</span>
    </div>
  )
}

function EmptyState({ title, detail, action, onAction }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><ArrowDownRight size={22} /></span>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{detail}</p>
      {action && <button onClick={onAction} className={`${buttonPrimary} mt-5`}>{action}</button>}
    </div>
  )
}

function Alert({ tone, children, onDismiss, className = '' }) {
  const styles = tone === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return (
    <div role="status" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${styles} ${className}`}>
      {children}
      {onDismiss && <button onClick={onDismiss} className="shrink-0 text-xs font-semibold underline">Dismiss</button>}
    </div>
  )
}

export default App
