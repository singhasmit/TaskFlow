const { validationResult } = require("express-validator");
const Job = require("../models/Job");
const {
  createJob,
  getOwnedJob,
  recoverPendingJobs,
  cancelJob,
  retryFailedJob,
} = require("../services/jobService");
const { AppError } = require("../errors");

function ensureValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);
}

async function submit(req, res, next) {
  try {
    ensureValid(req);
    const key = req.header("Idempotency-Key");
    if (!key || key.length > 128)
      throw new AppError("A valid Idempotency-Key header is required", 400);
    const { job, duplicate } = await createJob(req.user, req.body, key);
    res.status(duplicate ? 200 : 202).json({ job, duplicate });
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const query = { owner: req.user.id };
    if (req.query.status) query.status = req.query.status;
    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Job.countDocuments(query),
    ]);
    res.json({ jobs, pagination: { page, limit, total } });
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    res.json({ job: await getOwnedJob(req.params.id, req.user.id) });
  } catch (error) {
    next(error);
  }
}

async function stats(req, res, next) {
  try {
    res.json({ stats: await getStats(req.user._id) });
  } catch (error) {
    next(error);
  }
}

async function getStats(ownerId) {
  const rows = await Job.aggregate([
    { $match: { owner: ownerId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(rows.map((x) => [x._id, x.count]));
  return {
    queued: 0,
    active: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    queue_pending: 0,
    ...counts,
  };
}

async function dashboard(req, res, next) {
  try {
    const [jobs, stats] = await Promise.all([
      Job.find({ owner: req.user.id }).sort({ createdAt: -1 }).limit(20),
      getStats(req.user._id),
    ]);
    res.json({ jobs, stats });
  } catch (error) {
    next(error);
  }
}

async function recover(req, res, next) {
  try {
    res.json(await recoverPendingJobs());
  } catch (error) {
    next(error);
  }
}
async function cancel(req, res, next) {
  try {
    res.json({ job: await cancelJob(req.params.id, req.user.id) });
  } catch (error) {
    next(error);
  }
}
async function retry(req, res, next) {
  try {
    res
      .status(202)
      .json({ job: await retryFailedJob(req.params.id, req.user.id) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submit,
  list,
  detail,
  stats,
  dashboard,
  recover,
  cancel,
  retry,
};
