const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { after, before, test } = require('node:test')
const { createApp } = require('../src/app')
const { JOBS, matchJobs } = require('../src/jobs')
const { createStore } = require('../src/store')

let server
let baseUrl
let directory
let token
let secondToken

async function jsonRequest(route, { method = 'GET', body, authorization = token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
      ...headers,
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  })
  return { response, payload: response.status === 204 ? null : await response.json() }
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'skillsync-test-'))
  const app = createApp({
    store: createStore(path.join(directory, 'store.json')),
    jwtSecret: 'test-secret-with-enough-entropy',
    analyzeResume: async () => ({
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      extracted_text: 'Python, SQL, Excel, Data Analysis',
      skills: ['Python', 'SQL', 'Excel', 'Data Analysis'],
      technical_skills: ['Python', 'SQL', 'Excel', 'Data Analysis'],
      soft_skills: [],
    }),
  })
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  if (directory) await fs.rm(directory, { recursive: true, force: true })
})

test('job matching ranks overlaps and identifies every required skill gap', () => {
  const matches = matchJobs(['Python', 'SQL', 'Excel', 'Data Analysis'])
  assert.equal(matches[0].id, 'data-analyst')
  assert.equal(matches[0].match_percentage, 67)
  assert.deepEqual(matches[0].matched_skills, ['Python', 'SQL', 'Excel', 'Data Analysis'])
  assert.deepEqual(matches[0].missing_skills, ['Power BI', 'Data Visualization'])
  assert.equal(matchJobs([]).length, JOBS.length)
})

test('registration, login, and authenticated endpoints validate users', async () => {
  const unauthenticated = await jsonRequest('/api/dashboard', { authorization: null })
  assert.equal(unauthenticated.response.status, 401)

  const invalid = await jsonRequest('/api/auth/register', {
    method: 'POST',
    authorization: null,
    body: { name: 'J', email: 'not-an-email', password: 'short' },
  })
  assert.equal(invalid.response.status, 400)

  const registered = await jsonRequest('/api/auth/register', {
    method: 'POST',
    authorization: null,
    body: { name: 'Jordan Lee', email: 'Jordan@example.com', password: 'secure-pass-1' },
  })
  assert.equal(registered.response.status, 201)
  token = registered.payload.token

  const duplicate = await jsonRequest('/api/auth/register', {
    method: 'POST',
    authorization: null,
    body: { name: 'Jordan Lee', email: 'jordan@example.com', password: 'secure-pass-1' },
  })
  assert.equal(duplicate.response.status, 409)

  const login = await jsonRequest('/api/auth/login', {
    method: 'POST',
    authorization: null,
    body: { email: 'JORDAN@example.com', password: 'secure-pass-1' },
  })
  assert.equal(login.response.status, 200)

  const wrongPassword = await jsonRequest('/api/auth/login', {
    method: 'POST',
    authorization: null,
    body: { email: 'jordan@example.com', password: 'incorrect' },
  })
  assert.equal(wrongPassword.response.status, 401)

  const secondAccount = await jsonRequest('/api/auth/register', {
    method: 'POST',
    authorization: null,
    body: { name: 'Taylor Kim', email: 'taylor@example.com', password: 'secure-pass-2' },
  })
  secondToken = secondAccount.payload.token
})

test('resume upload builds personalized job matches and persists learning progress', async () => {
  const form = new FormData()
  form.append('resume', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'resume.pdf')
  const { response: uploadResponse, payload } = await jsonRequest('/api/resume/analyze', { method: 'POST', body: form })
  assert.equal(uploadResponse.status, 200)
  assert.equal(payload.total_skills, 4)
  assert.equal(payload.profile.name, 'Jordan Lee')

  const dashboard = await jsonRequest('/api/dashboard')
  assert.equal(dashboard.response.status, 200)
  assert.equal(dashboard.payload.jobs[0].id, 'data-analyst')
  assert.equal(dashboard.payload.jobs[0].roadmap[0].skill, 'Power BI')

  const progress = await jsonRequest('/api/progress/Power%20BI', {
    method: 'PATCH',
    body: { completed: true },
  })
  assert.equal(progress.response.status, 200)
  assert.ok(progress.payload.completedSkills.includes('Power BI'))

  const refreshed = await jsonRequest('/api/dashboard')
  assert.equal(refreshed.payload.jobs[0].roadmap[0].completed, true)
  const persisted = await createStore(path.join(directory, 'store.json')).read()
  assert.equal(persisted.profiles[(await jsonRequest('/api/auth/me')).payload.user.id].email, 'jordan@example.com')

  const invalidPdf = new FormData()
  invalidPdf.append('resume', new Blob(['not a PDF'], { type: 'application/pdf' }), 'resume.pdf')
  const invalid = await jsonRequest('/api/resume/analyze', { method: 'POST', body: invalidPdf })
  assert.equal(invalid.response.status, 400)
})

test('application tracking supports updates and keeps records private per account', async () => {
  const created = await jsonRequest('/api/applications', {
    method: 'POST',
    body: { jobId: 'data-analyst', notes: 'Tailor portfolio first.' },
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.payload.status, 'Applied')

  const hiddenFromOtherUser = await jsonRequest(`/api/applications/${created.payload.id}`, {
    authorization: secondToken,
    method: 'PATCH',
    body: { status: 'Offer' },
  })
  assert.equal(hiddenFromOtherUser.response.status, 404)

  const updated = await jsonRequest(`/api/applications/${created.payload.id}`, {
    method: 'PATCH',
    body: { status: 'Interview', notes: 'First round scheduled.' },
  })
  assert.equal(updated.payload.status, 'Interview')

  const dashboard = await jsonRequest('/api/dashboard')
  assert.equal(dashboard.payload.applications.length, 1)
  assert.equal(dashboard.payload.applications[0].job.title, 'Data Analyst')

  const deleted = await jsonRequest(`/api/applications/${created.payload.id}`, { method: 'DELETE' })
  assert.equal(deleted.response.status, 204)
})
