const Job = require('../models/Job');
const { enqueueJob, jobQueue } = require('../queue');
const { AppError } = require('../errors');

async function createJob(owner, input, idempotencyKey) {
  let record;
  try {
    record = await Job.create({ ...input, owner: owner.id, idempotencyKey, events: [{ type: 'created', message: 'Job record created' }] });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Job.findOne({ owner: owner.id, idempotencyKey });
      return { job: existing, duplicate: true };
    }
    throw error;
  }

  try {
    const queueJobId = await enqueueJob(record);
    record.queueJobId = String(queueJobId);
    record.status = 'queued';
    record.queuedAt = new Date();
    record.events.push({ type: 'queued', message: record.scheduledAt ? 'Job scheduled in BullMQ' : 'Job added to BullMQ' });
    await record.save();
  } catch (error) {
    // The recovery endpoint can retry queue_pending records after Redis recovers.
    record.error = `Queue submission failed: ${error.message}`;
    record.events.push({ type: 'queue_error', message: 'Redis was unavailable; recovery is required' });
    await record.save();
  }
  return { job: record, duplicate: false };
}

async function recoverPendingJobs() {
  const jobs = await Job.find({ status: 'queue_pending' }).limit(100);
  const outcomes = await Promise.allSettled(jobs.map(async (record) => {
    const queueJobId = await enqueueJob(record);
    record.set({ queueJobId: String(queueJobId), status: 'queued', queuedAt: new Date(), error: undefined });
    record.events.push({ type: 'recovered', message: 'Job was re-enqueued after queue recovery' });
    await record.save();
  }));
  return { found: jobs.length, recovered: outcomes.filter((x) => x.status === 'fulfilled').length };
}

async function getOwnedJob(id, ownerId) {
  const job = await Job.findOne({ _id: id, owner: ownerId });
  if (!job) throw new AppError('Job not found', 404);
  return job;
}

async function cancelJob(id, ownerId) {
  const record = await getOwnedJob(id, ownerId);
  if (!['queue_pending', 'queued'].includes(record.status)) throw new AppError('Only jobs waiting to run can be cancelled', 409);
  if (record.queueJobId) {
    const queueJob = await jobQueue.getJob(record.queueJobId);
    if (queueJob) await queueJob.remove();
  }
  record.set({ status: 'cancelled', cancelledAt: new Date(), error: undefined });
  record.events.push({ type: 'cancelled', message: 'Cancelled by the job owner before processing began' });
  await record.save();
  return record;
}

async function retryFailedJob(id, ownerId) {
  const record = await getOwnedJob(id, ownerId);
  if (record.status !== 'failed') throw new AppError('Only failed jobs can be retried manually', 409);
  const oldQueueJob = record.queueJobId && await jobQueue.getJob(record.queueJobId);
  if (oldQueueJob) await oldQueueJob.remove();
  record.set({ status: 'queue_pending', attemptsMade: 0, progress: 0, error: undefined, failedAt: undefined, completedAt: undefined, result: undefined });
  record.events.push({ type: 'manual_retry_requested', message: 'Owner requested a fresh retry cycle' });
  await record.save();
  const queueJobId = await enqueueJob(record, { forceNew: true });
  record.set({ queueJobId: String(queueJobId), status: 'queued', queuedAt: new Date() });
  record.events.push({ type: 'queued', message: 'Manual retry added to BullMQ' });
  await record.save();
  return record;
}

module.exports = { createJob, recoverPendingJobs, getOwnedJob, cancelJob, retryFailedJob };
