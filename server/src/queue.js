const { Queue } = require('bullmq');
const { redisUrl } = require('./config');

const connection = { url: redisUrl, maxRetriesPerRequest: null };
const jobQueue = new Queue('taskflow-jobs', { connection });

async function enqueueJob(record, { forceNew = false } = {}) {
  const queueJob = await jobQueue.add(record.type, { jobRecordId: record.id }, {
    jobId: forceNew ? `${record.id}:retry:${Date.now()}` : record.id,
    attempts: record.attempts,
    backoff: { type: 'exponential', delay: 1000 },
    priority: record.priority,
    delay: record.scheduledAt ? Math.max(new Date(record.scheduledAt).getTime() - Date.now(), 0) : 0,
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 1000 },
  });
  return queueJob.id;
}

module.exports = { connection, jobQueue, enqueueJob };
