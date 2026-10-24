const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  number: Number,
  startedAt: Date,
  finishedAt: Date,
  error: String,
}, { _id: false });

const eventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  at: { type: Date, default: Date.now },
}, { _id: false });

const jobSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['email', 'report'], required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['queue_pending', 'queued', 'active', 'completed', 'failed', 'cancelled'], default: 'queue_pending', index: true },
  priority: { type: Number, min: 1, max: 10, default: 5 },
  attempts: { type: Number, min: 1, max: 5, default: 3 },
  attemptsMade: { type: Number, default: 0 },
  idempotencyKey: { type: String, required: true },
  queueJobId: { type: String, unique: true, sparse: true },
  result: mongoose.Schema.Types.Mixed,
  error: String,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  startedAt: Date,
  completedAt: Date,
  failedAt: Date,
  queuedAt: Date,
  scheduledAt: Date,
  cancelledAt: Date,
  attemptHistory: { type: [attemptSchema], default: [] },
  events: { type: [eventSchema], default: [] },
}, { timestamps: true });

jobSchema.index({ owner: 1, idempotencyKey: 1 }, { unique: true });
jobSchema.index({ owner: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Job', jobSchema);
