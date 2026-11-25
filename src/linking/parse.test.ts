import { parseIncomingUrl } from '@/linking/parse';

describe('incoming links', () => {
  it('reads a mock magic link, a supabase code, and a job id', () => {
    expect(parseIncomingUrl('jobflow://auth/callback?token=ml_123')).toEqual({ type: 'magic', token: 'ml_123' });
    expect(parseIncomingUrl('https://jobflow-app.quvantic.com/auth/callback?code=abc')).toEqual({
      type: 'code',
      code: 'abc',
    });
    expect(parseIncomingUrl('https://jobflow-app.quvantic.com/auth/callback#access_token=a&refresh_token=b')).toEqual({
      type: 'session',
      accessToken: 'a',
      refreshToken: 'b',
    });
    expect(parseIncomingUrl('jobflow://job/job_harbor_lila')).toEqual({ type: 'job', jobId: 'job_harbor_lila' });
    expect(parseIncomingUrl('https://jobflow-app.quvantic.com/job/job_harbor_lila')).toEqual({
      type: 'job',
      jobId: 'job_harbor_lila',
    });
    expect(parseIncomingUrl('https://jobflow-app.quvantic.com/today')).toEqual({ type: 'ignore' });
  });
});
