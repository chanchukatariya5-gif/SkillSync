const fs = require('node:fs/promises')
const path = require('node:path')

function createStore(filePath = process.env.SKILLSYNC_DATA_FILE || path.join(__dirname, '..', 'data', 'store.json')) {
  let writeQueue = Promise.resolve()

  async function load() {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { users: [], profiles: {}, applications: [], progress: {} }
      }
      throw error
    }
  }

  return {
    async read() {
      await writeQueue
      return load()
    },

    update(mutator) {
      const operation = writeQueue.then(async () => {
        const state = await load()
        const result = await mutator(state)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        const temporaryPath = `${filePath}.${process.pid}.tmp`
        await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), { mode: 0o600 })
        await fs.rename(temporaryPath, filePath)
        return result
      })
      writeQueue = operation.catch(() => {})
      return operation
    },
  }
}

module.exports = { createStore }
