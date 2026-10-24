require("./dns.js");

const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { connectDatabase } = require('./db');
const { validateEnvironment, workerConcurrency } = require('./config');
const Job = require('./models/Job');

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function execute(record, bullJob) {
  if (['completed', 'cancelled'].includes(record.status)) return record.result;
  record.status = 'active';
  record.startedAt ||= new Date();
  record.attemptsMade = bullJob.attemptsMade + 1;
  record.attemptHistory.push({ number: record.attemptsMade, startedAt: new Date() });
  record.events.push({ type: 'started', message: `Worker started attempt ${record.attemptsMade}` });
  await record.save();
  await bullJob.updateProgress(20);
  await pause(300);
  if (record.payload.simulateFailure) throw new Error('Simulated processing failure');
  await bullJob.updateProgress(80);
  await pause(300);
  const result = record.type === 'email'
    ? { message: 'Email accepted by simulator', recipient: record.payload.to, deliveredAt: new Date().toISOString() }
    : { reportUrl: `/reports/${record.id}.json`, generatedAt: new Date().toISOString(), rows: 42 };
  record.set({ status: 'completed', progress: 100, result, completedAt: new Date(), error: undefined });
  record.events.push({ type: 'completed', message: 'Worker completed the job successfully' });
  const lastAttempt = record.attemptHistory.at(-1);
  if (lastAttempt) lastAttempt.finishedAt = new Date();
  await record.save();
  return result;
}

async function start() {
  validateEnvironment();
  await connectDatabase();
  const worker = new Worker('taskflow-jobs', async (bullJob) => {
    const record = await Job.findById(bullJob.data.jobRecordId);
    if (!record) throw new Error('Job record not found');
    return execute(record, bullJob);
  }, { connection, concurrency: workerConcurrency });
  worker.on('failed', async (bullJob, error) => {
    if (!bullJob) return;
    const terminal = bullJob.attemptsMade >= bullJob.opts.attempts;
    await Job.findByIdAndUpdate(bullJob.data.jobRecordId, {
      $set: terminal ? { status: 'failed', error: error.message, failedAt: new Date() } : { status: 'queued', error: error.message },
      $push: { attemptHistory: { number: bullJob.attemptsMade, finishedAt: new Date(), error: error.message } },
    });
    await Job.findByIdAndUpdate(bullJob.data.jobRecordId, { $push: { events: { type: terminal ? 'failed' : 'retrying', message: terminal ? 'All attempts were exhausted' : 'Attempt failed; BullMQ will retry with backoff' } } });
  });
  worker.on('error', (error) => console.error('Worker error:', error));
  console.log(`TaskFlow worker running with concurrency ${workerConcurrency}`);
  const shutdown = async () => { await worker.close(); process.exit(0); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => { console.error(error); process.exit(1); });
