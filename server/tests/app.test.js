jest.mock('../src/queue', () => ({ enqueueJob: jest.fn(), connection: {} }));
const request = require('supertest');
const app = require('../src/app');

describe('HTTP baseline', () => {
  test('health endpoint is public', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('private jobs endpoint rejects anonymous callers', async () => {
    const response = await request(app).get('/api/jobs');
    expect(response.status).toBe(401);
  });
});
