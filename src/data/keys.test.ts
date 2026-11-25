import { assertPublishableKey } from '@/data/keys';
import { JobflowError } from '@/domain/errors';

function jwt(payload: object): string {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${body}.sig`;
}

describe('publishable key guard', () => {
  it('accepts an anon jwt and a publishable key', () => {
    expect(() => assertPublishableKey(jwt({ role: 'anon' }))).not.toThrow();
    expect(() => assertPublishableKey('sb_publishable_example')).not.toThrow();
  });

  it('rejects a service-role jwt and a secret key', () => {
    expect(() => assertPublishableKey(jwt({ role: 'service_role' }))).toThrow(JobflowError);
    expect(() => assertPublishableKey('sb_secret_example')).toThrow(/secret Supabase key/);
  });
});
