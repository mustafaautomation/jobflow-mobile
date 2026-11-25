import { CachingRepository } from '@/data/cache';
import { MemoryRepository } from '@/data/memory-repository';
import { buildSeed } from '@/data/seed';
import type { Connectivity } from '@/data/connectivity';
import { JobflowError } from '@/domain/errors';
import { memoryKv } from '@/storage/kv';
import type { Actor } from '@/domain/types';

const now = new Date(2026, 10, 25, 15, 0, 0);

class Switch implements Connectivity {
  online = true;
  async isOnline() {
    return this.online;
  }
  subscribe() {
    return () => {};
  }
}

function setup() {
  const inner = new MemoryRepository(buildSeed(now), { now: () => now });
  const link = new Switch();
  const cache = new CachingRepository(inner, memoryKv(), link, () => now);
  const actor = inner.actorFor('user_alex', 'org_harbor');
  return { inner, link, cache, actor };
}

describe('offline cache', () => {
  it('serves the last saved job when the network drops and replays the queued start', async () => {
    const { inner, link, cache, actor } = setup();
    const calls: string[] = [];
    const original = inner.transitionJob.bind(inner);
    inner.transitionJob = async (person: Actor, jobId: string, action) => {
      calls.push(`${action}:${jobId}`);
      return original(person, jobId, action);
    };
    await cache.getJob(actor, 'job_harbor_lila');
    link.online = false;
    const started = await cache.transitionJob(actor, 'job_harbor_lila', 'start');
    expect(started.status).toBe('in_progress');
    expect(calls).toEqual([]);
    expect(await cache.pendingCount()).toBe(1);
    const cached = await cache.getJob(actor, 'job_harbor_lila');
    expect(cached.status).toBe('in_progress');
    link.online = true;
    await cache.listTodayJobs(actor);
    expect(calls).toEqual(['start:job_harbor_lila']);
    expect(await cache.pendingCount()).toBe(0);
    expect((await inner.getJob(actor, 'job_harbor_lila')).status).toBe('in_progress');
  });

  it('falls back to the cached list when a read fails on the network', async () => {
    const { inner, cache, actor } = setup();
    const first = await cache.listTodayJobs(actor);
    inner.listTodayJobs = async () => {
      throw new JobflowError('network', 'offline');
    };
    const second = await cache.listTodayJobs(actor);
    expect(second.map((job) => job.id)).toEqual(first.map((job) => job.id));
  });
});
