export type IncomingLink =
  | { type: 'magic'; token: string }
  | { type: 'code'; code: string }
  | { type: 'session'; accessToken: string; refreshToken: string }
  | { type: 'job'; jobId: string }
  | { type: 'ignore' };

function queryAndHash(input: string): { path: string; query: URLSearchParams; hash: URLSearchParams } {
  const [beforeHash, hashPart] = input.split('#');
  const [path, queryPart] = (beforeHash ?? '').split('?');
  return {
    path: path ?? '',
    query: new URLSearchParams(queryPart ?? ''),
    hash: new URLSearchParams(hashPart ?? ''),
  };
}

export function parseIncomingUrl(input: string): IncomingLink {
  const raw = input.trim();
  if (!raw) return { type: 'ignore' };
  const { path, query, hash } = queryAndHash(raw);
  const token = query.get('token');
  if (token) return { type: 'magic', token };
  const code = query.get('code');
  if (code) return { type: 'code', code };
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    return { type: 'session', accessToken, refreshToken };
  }
  const match = path.match(/(?:^|\/)job\/([A-Za-z0-9_-]+)/);
  const jobId = match?.[1];
  if (jobId) return { type: 'job', jobId };
  return { type: 'ignore' };
}
