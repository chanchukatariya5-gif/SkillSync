const crypto = require('node:crypto')
const axios = require('axios')
const bcrypt = require('bcryptjs')
const cors = require('cors')
const express = require('express')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const { AVAILABLE_SKILLS, JOBS, createRoadmap, matchJobs } = require('./jobs')
const { createStore } = require('./store')

const APPLICATION_STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']

function createApp({
  store = createStore(),
  analyzeResume = async (buffer, filename) => {
    const form = new (require('form-data'))()
    form.append('resume', buffer, { filename, contentType: 'application/pdf' })
    const response = await axios.post(
      `${process.env.RESUME_SERVICE_URL || 'http://127.0.0.1:8000'}/analyze`,
      form,
      { headers: form.getHeaders(), maxBodyLength: 5 * 1024 * 1024 + 64 * 1024, timeout: 30000 },
    )
    return response.data
  },
  jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'skillsync-local-development-secret'),
} = {}) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be set in production.')
  }

  const app = express()
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173'
  app.use(cors({ origin: allowedOrigin }))
  app.use(express.json({ limit: '100kb' }))
  app.use((request, response, next) => {
    request.body ||= {}
    next()
  })

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (request, file, callback) => {
      if (file.mimetype !== 'application/pdf' || !file.originalname.toLowerCase().endsWith('.pdf')) {
        callback(new Error('Only PDF files are allowed.'))
        return
      }
      callback(null, true)
    },
  })

  function issueToken(user) {
    return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' })
  }

  function requireAuth(request, response, next) {
    const authorization = request.get('authorization') || ''
    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) {
      response.status(401).json({ error: 'Please sign in to continue.' })
      return
    }
    try {
      request.userId = jwt.verify(token, jwtSecret).sub
      next()
    } catch {
      response.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }
  }

  app.get('/api/health', (request, response) => response.json({ status: 'ok' }))

  app.post('/api/auth/register', async (request, response, next) => {
    try {
      const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
      const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
      const password = typeof request.body.password === 'string' ? request.body.password : ''
      if (name.length < 2 || name.length > 80) {
        response.status(400).json({ error: 'Name must be between 2 and 80 characters.' })
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        response.status(400).json({ error: 'Enter a valid email address.' })
        return
      }
      if (password.length < 8 || password.length > 128) {
        response.status(400).json({ error: 'Password must be between 8 and 128 characters.' })
        return
      }

      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        createdAt: new Date().toISOString(),
      }
      const created = await store.update((state) => {
        if (state.users.some((existing) => existing.email === email)) return false
        state.users.push(user)
        return true
      })
      if (!created) {
        response.status(409).json({ error: 'An account with that email already exists.' })
        return
      }
      response.status(201).json({ token: issueToken(user), user: { id: user.id, name, email } })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/auth/login', async (request, response, next) => {
    try {
      const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
      const password = typeof request.body.password === 'string' ? request.body.password : ''
      const state = await store.read()
      const user = state.users.find((candidate) => candidate.email === email)
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        response.status(401).json({ error: 'Email or password is incorrect.' })
        return
      }
      response.json({ token: issueToken(user), user: { id: user.id, name: user.name, email } })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/auth/me', requireAuth, async (request, response, next) => {
    try {
      const state = await store.read()
      const user = state.users.find((candidate) => candidate.id === request.userId)
      if (!user) {
        response.status(401).json({ error: 'Account not found. Please sign in again.' })
        return
      }
      response.json({ user: { id: user.id, name: user.name, email: user.email } })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/resume/analyze', requireAuth, upload.single('resume'), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: 'Please upload a PDF resume.' })
        return
      }
      if (request.file.buffer.subarray(0, 5).toString() !== '%PDF-') {
        response.status(400).json({ error: 'The uploaded file is not a valid PDF.' })
        return
      }

      const analysis = await analyzeResume(request.file.buffer, request.file.originalname)
      if (!analysis || !Array.isArray(analysis.skills) || typeof analysis.extracted_text !== 'string') {
        response.status(502).json({ error: 'Resume service returned an invalid analysis.' })
        return
      }
      const profile = {
        filename: request.file.originalname,
        analyzedAt: new Date().toISOString(),
        name: analysis.name || '',
        email: analysis.email || '',
        skills: analysis.skills,
        technical_skills: analysis.technical_skills || [],
        soft_skills: analysis.soft_skills || [],
        extracted_text: analysis.extracted_text.slice(0, 100000),
      }
      await store.update((state) => {
        state.profiles[request.userId] = profile
      })
      response.json({ success: true, profile, total_skills: profile.skills.length })
    } catch (error) {
      if (error.response?.data?.error) {
        response.status(422).json({ error: error.response.data.error })
        return
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
        response.status(503).json({ error: 'Resume analysis is unavailable. Start the resume service and try again.' })
        return
      }
      next(error)
    }
  })

  app.get('/api/dashboard', requireAuth, async (request, response, next) => {
    try {
      const state = await store.read()
      const profile = state.profiles[request.userId] || null
      const completedSkills = state.progress[request.userId] || []
      const jobs = matchJobs(profile?.skills || []).map((job) => ({
        ...job,
        roadmap: createRoadmap(job, completedSkills),
      }))
      const applications = state.applications
        .filter((application) => application.userId === request.userId)
        .map((application) => ({
          ...application,
          job: JOBS.find((job) => job.id === application.jobId) || null,
        }))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      response.json({ profile, jobs, applications, completedSkills })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/applications', requireAuth, async (request, response, next) => {
    try {
      const job = JOBS.find((candidate) => candidate.id === request.body.jobId)
      const status = request.body.status || 'Applied'
      if (!job) {
        response.status(400).json({ error: 'Choose a valid job opportunity.' })
        return
      }
      if (!APPLICATION_STATUSES.includes(status)) {
        response.status(400).json({ error: 'Choose a valid application status.' })
        return
      }
      const application = {
        id: crypto.randomUUID(),
        userId: request.userId,
        jobId: job.id,
        status,
        notes: typeof request.body.notes === 'string' ? request.body.notes.trim().slice(0, 1000) : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await store.update((state) => state.applications.push(application))
      response.status(201).json({ ...application, job })
    } catch (error) {
      next(error)
    }
  })

  app.patch('/api/applications/:id', requireAuth, async (request, response, next) => {
    try {
      const { status, notes } = request.body
      if (status !== undefined && !APPLICATION_STATUSES.includes(status)) {
        response.status(400).json({ error: 'Choose a valid application status.' })
        return
      }
      if (notes !== undefined && typeof notes !== 'string') {
        response.status(400).json({ error: 'Application notes must be text.' })
        return
      }
      const application = await store.update((state) => {
        const existing = state.applications.find((item) => item.id === request.params.id && item.userId === request.userId)
        if (!existing) return null
        if (status !== undefined) existing.status = status
        if (notes !== undefined) existing.notes = notes.trim().slice(0, 1000)
        existing.updatedAt = new Date().toISOString()
        return existing
      })
      if (!application) {
        response.status(404).json({ error: 'Application not found.' })
        return
      }
      response.json({ ...application, job: JOBS.find((job) => job.id === application.jobId) || null })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/applications/:id', requireAuth, async (request, response, next) => {
    try {
      const deleted = await store.update((state) => {
        const index = state.applications.findIndex((item) => item.id === request.params.id && item.userId === request.userId)
        if (index === -1) return false
        state.applications.splice(index, 1)
        return true
      })
      if (!deleted) {
        response.status(404).json({ error: 'Application not found.' })
        return
      }
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  app.patch('/api/progress/:skill', requireAuth, async (request, response, next) => {
    try {
      const skill = AVAILABLE_SKILLS.find((candidate) => candidate.toLowerCase() === request.params.skill.toLowerCase())
      if (!skill || typeof request.body.completed !== 'boolean') {
        response.status(400).json({ error: 'Choose a valid skill and completion value.' })
        return
      }
      const completedSkills = await store.update((state) => {
        const progress = new Set(state.progress[request.userId] || [])
        if (request.body.completed) progress.add(skill)
        else progress.delete(skill)
        state.progress[request.userId] = [...progress]
        return state.progress[request.userId]
      })
      response.json({ completedSkills })
    } catch (error) {
      next(error)
    }
  })

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error)
      return
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({ error: 'Resume must be 5 MB or smaller.' })
      return
    }
    if (error.message === 'Only PDF files are allowed.') {
      response.status(400).json({ error: error.message })
      return
    }
    console.error('API request failed:', error.message)
    response.status(500).json({ error: 'An unexpected server error occurred.' })
  })

  return app
}

module.exports = { APPLICATION_STATUSES, createApp }
