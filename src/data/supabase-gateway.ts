import { JobflowError } from '@/domain/errors';
import type { DataGateway, Row, SelectQuery } from '@/data/rows';

interface PostgrestError {
  message?: string;
  code?: string;
}

export function mapSupabaseError(error: PostgrestError): JobflowError {
  const message = error.message ?? 'The request failed.';
  const code = error.code ?? '';
  if (/fetch|network|failed to fetch|timeout|econn/i.test(message)) {
    return new JobflowError('network', 'The network request failed. Saved jobs stay on this device.');
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return new JobflowError('forbidden', 'You do not have access to that record.');
  }
  return new JobflowError('invalid', message);
}

interface FilterChain {
  eq(column: string, value: string): FilterChain;
  gte(column: string, value: string): FilterChain;
  lt(column: string, value: string): FilterChain;
  then<TResult1 = { data: Row[] | null; error: PostgrestError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: PostgrestError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export interface SupabaseQueryClient {
  from(table: string): {
    select(columns?: string): FilterChain;
    insert(row: Row): FilterChain;
    update(row: Row): FilterChain;
  };
}

export function createSupabaseGateway(client: SupabaseQueryClient): DataGateway {
  return {
    async select(table, query) {
      let chain = client.from(table).select('*');
      chain = applyQuery(chain, query);
      const { data, error } = await chain;
      if (error) throw mapSupabaseError(error);
      return data ?? [];
    },
    async insert(table, row) {
      const { data, error } = await client.from(table).insert(row);
      if (error) throw mapSupabaseError(error);
      return data?.[0] ?? row;
    },
    async update(table, filters, patch) {
      let chain = client.from(table).update(patch);
      for (const [key, value] of Object.entries(filters)) chain = chain.eq(key, value);
      const { error } = await chain;
      if (error) throw mapSupabaseError(error);
    },
  };
}

function applyQuery(chain: FilterChain, query: SelectQuery = {}): FilterChain {
  let next = chain;
  for (const [key, value] of Object.entries(query.filters ?? {})) next = next.eq(key, value);
  for (const [key, value] of Object.entries(query.gte ?? {})) next = next.gte(key, value);
  for (const [key, value] of Object.entries(query.lt ?? {})) next = next.lt(key, value);
  return next;
}
