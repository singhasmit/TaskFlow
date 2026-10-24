jest.mock('../src/models/Job', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/queue', () => ({ enqueueJob: jest.fn() }));
const Job = require('../src/models/Job');
const { enqueueJob } = require('../src/queue');
const { createJob } = require('../src/services/jobService');

describe('job submission', () => {
  const owner = { id: 'user-1' };
  const input = { type: 'email', payload: { to: 'person@example.com' }, attempts: 3, priority: 5 };

  beforeEach(() => jest.clearAllMocks());

  test('returns an existing record when the idempotency key already exists', async () => {
    const existing = { id: 'job-1' };
    Job.create.mockRejectedValue({ code: 11000 });
    Job.findOne.mockResolvedValue(existing);
    await expect(createJob(owner, input, 'same-key')).resolves.toEqual({ job: existing, duplicate: true });
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  test('keeps a durable queue_pending record if Redis enqueue fails', async () => {
    const record = { id: 'job-2', events: [], save: jest.fn().mockResolvedValue() };
    Job.create.mockResolvedValue(record);
    enqueueJob.mockRejectedValue(new Error('Redis unavailable'));
    const result = await createJob(owner, input, 'key-2');
    expect(result.duplicate).toBe(false);
    expect(record.error).toContain('Redis unavailable');
    expect(record.save).toHaveBeenCalled();
  });
});
