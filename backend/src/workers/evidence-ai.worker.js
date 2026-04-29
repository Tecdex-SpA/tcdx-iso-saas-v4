require('dotenv').config()
const { processEvidenceAiJobs } = require('../services/evidence-ai.service')

const POLL_INTERVAL_MS = Number(process.env.EVIDENCE_AI_WORKER_POLL_MS || 5000)
const BATCH_SIZE = Math.max(1, Math.min(20, Number(process.env.EVIDENCE_AI_WORKER_BATCH_SIZE || 3)))
const WORKER_NAME = process.env.EVIDENCE_AI_WORKER_NAME || 'evidence-ai-worker-120'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log(`[${WORKER_NAME}] iniciado. Batch=${BATCH_SIZE}, poll=${POLL_INTERVAL_MS}ms`)

  while (true) {
    try {
      const processed = await processEvidenceAiJobs(BATCH_SIZE, WORKER_NAME)

      if (processed.length > 0) {
        console.log(`[${WORKER_NAME}] jobs procesados: ${processed.length}`)
      } else {
        await sleep(POLL_INTERVAL_MS)
      }
    } catch (err) {
      console.error(`[${WORKER_NAME}] error:`, err.message)
      await sleep(POLL_INTERVAL_MS)
    }
  }
}

run().catch((err) => {
  console.error(`[${WORKER_NAME}] fatal:`, err)
  process.exit(1)
})
