import { distanceMiles } from '@/domain/geo';
import { JobflowError } from '@/domain/errors';
import { MemoryRepository } from '@/data/memory-repository';
import { buildSeed } from '@/data/seed';

const now = new Date(2026, 10, 25, 15, 0, 0);

function repo() {
  return new MemoryRepository(buildSeed(now), { now: () => now });
}

function alex(store = repo()) {
  return { store, actor: store.actorFor('user_alex', 'org_harbor') };
}

function jordan(store = repo()) {
  return { store, actor: store.actorFor('user_jordan', 'org_harbor') };
}

describe('memory repository', () => {
  it('shows only the signed-in technician’s jobs for today', async () => {
    const { store, actor } = alex();
    const jobs = await store.listTodayJobs(actor);
    expect(jobs.map((job) => job.id)).toEqual([
      'job_harbor_elena',
      'job_harbor_lila',
      'job_harbor_greenbelt',
      'job_harbor_hart',
    ]);
    expect(jobs.some((job) => job.customerName === 'Priya Shah')).toBe(false);
  });

  it('hides another tenant’s jobs', async () => {
    const { store, actor } = alex();
    await expect(store.getJob(actor, 'job_summit_lohi')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('orders the route and computes miles between stops', async () => {
    const { store, actor } = alex();
    const route = await store.listMyRoute(actor);
    expect(route.map((stop) => stop.routePosition)).toEqual([1, 2, 3, 4]);
    expect(route[0]?.distanceFromPreviousMiles).toBeNull();
    expect(route[1]?.distanceFromPreviousMiles ?? 0).toBeGreaterThan(0.5);
    expect(route[1]?.distanceFromPreviousMiles).toBeCloseTo(
      distanceMiles({ lat: 30.251, lng: -97.749 }, { lat: 30.2627, lng: -97.7265 }),
      5,
    );
  });

  it('starts, pauses, resumes, and completes a job for the assignee only', async () => {
    const store = repo();
    const tech = store.actorFor('user_alex', 'org_harbor');
    const dispatcher = store.actorFor('user_jordan', 'org_harbor');
    await expect(store.transitionJob(dispatcher, 'job_harbor_lila', 'start')).rejects.toMatchObject({
      code: 'forbidden',
    });
    const started = await store.transitionJob(tech, 'job_harbor_lila', 'start');
    expect(started.status).toBe('in_progress');
    expect(started.startedAt).toBeTruthy();
    const paused = await store.transitionJob(tech, 'job_harbor_lila', 'pause');
    expect(paused.status).toBe('paused');
    const resumed = await store.transitionJob(tech, 'job_harbor_lila', 'resume');
    expect(resumed.status).toBe('in_progress');
    const done = await store.transitionJob(tech, 'job_harbor_lila', 'complete');
    expect(done.status).toBe('completed');
    await expect(store.transitionJob(tech, 'job_harbor_lila', 'pause')).rejects.toBeInstanceOf(JobflowError);
    const alexMember = store.snapshot().members.find((member) => member.id === 'member_alex_harbor');
    expect(alexMember?.status).toBe('available');
  });

  it('moves a technician to en route and then on the job', async () => {
    const { store, actor } = alex();
    await store.transitionJob(actor, 'job_harbor_lila', 'start_travel');
    expect(store.snapshot().members.find((member) => member.id === actor.memberId)?.status).toBe('en_route');
    await store.transitionJob(actor, 'job_harbor_lila', 'start');
    expect(store.snapshot().members.find((member) => member.id === actor.memberId)?.status).toBe('on_job');
  });

  it('lets the assignee complete checklist items, notes, photos, and a signature', async () => {
    const { store, actor } = alex();
    const checked = await store.toggleChecklistItem(actor, 'job_harbor_lila', 'job_harbor_lila_chk_1', true);
    expect(checked.checklist.find((item) => item.id === 'job_harbor_lila_chk_1')?.completed).toBe(true);
    const noted = await store.addNote(actor, 'job_harbor_lila', '  Capacitor reads 4.2 of a 5 µF rating.  ');
    expect(noted.notes.at(-1)?.body).toContain('4.2');
    expect(noted.notes.at(-1)?.authorName).toBe('Alex Rivera');
    await expect(store.addNote(actor, 'job_harbor_lila', '   ')).rejects.toMatchObject({ code: 'invalid' });
    const photographed = await store.addPhoto(actor, 'job_harbor_lila', {
      uri: 'stamp://job_harbor_lila/cap',
      caption: 'Bulged capacitor',
    });
    expect(photographed.photos.at(-1)?.caption).toBe('Bulged capacitor');
    const signed = await store.saveSignature(actor, 'job_harbor_lila', {
      signerName: 'Lila Nguyen',
      strokes: [{ points: [{ x: 1, y: 2 }] }],
    });
    expect(signed.signature?.signerName).toBe('Lila Nguyen');
    const replaced = await store.saveSignature(actor, 'job_harbor_lila', {
      signerName: 'Lila N.',
      strokes: [],
    });
    expect(replaced.signature?.signerName).toBe('Lila N.');
    expect(store.snapshot().signatures.filter((item) => item.jobId === 'job_harbor_lila')).toHaveLength(1);
  });

  it('collects a card payment or marks the job invoiced, but not both', async () => {
    const store = repo();
    const tech = store.actorFor('user_alex', 'org_harbor');
    const dispatcher = store.actorFor('user_jordan', 'org_harbor');
    const invoiced = await store.markInvoiced(dispatcher, 'job_harbor_greenbelt');
    expect(invoiced.invoiceStatus).toBe('invoiced');
    expect(invoiced.payments.at(-1)?.method).toBe('invoice');
    const again = await store.markInvoiced(tech, 'job_harbor_greenbelt');
    expect(again.payments.filter((payment) => payment.method === 'invoice')).toHaveLength(1);
    const paid = await store.collectPayment(tech, 'job_harbor_lila', { method: 'card', amountCents: 42800 });
    expect(paid.invoiceStatus).toBe('paid');
    expect(paid.payments.at(-1)?.stripePaymentIntentId).toMatch(/^pi_demo_/);
    await expect(store.markInvoiced(dispatcher, 'job_harbor_lila')).rejects.toMatchObject({ code: 'conflict' });
    await expect(store.collectPayment(dispatcher, 'job_harbor_hart', { method: 'cash', amountCents: 100 })).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('lets dispatch reassign an open job and notifies the new technician', async () => {
    const store = repo();
    const dispatcher = store.actorFor('user_jordan', 'org_harbor');
    const tech = store.actorFor('user_alex', 'org_harbor');
    await expect(store.reassignJob(tech, 'job_harbor_mueller', 'member_casey_harbor')).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(store.listDispatchBoard(tech)).rejects.toMatchObject({ code: 'forbidden' });
    const board = await store.listDispatchBoard(dispatcher);
    expect(board.unassigned.map((job) => job.id)).toContain('job_harbor_mueller');
    expect(board.technicians.find((person) => person.memberId === 'member_priya_harbor')?.status).toBe('en_route');
    expect(board.technicians.find((person) => person.memberId === 'member_casey_harbor')?.status).toBe('offline');
    const moved = await store.reassignJob(dispatcher, 'job_harbor_mueller', 'member_casey_harbor');
    expect(moved.assigneeName).toBe('Casey Nguyen');
    const casey = store.actorFor('user_casey', 'org_harbor');
    const caseyJobs = await store.listTodayJobs(casey);
    expect(caseyJobs.map((job) => job.id)).toContain('job_harbor_mueller');
    const notes = await store.listNotifications(casey);
    expect(notes[0]?.title).toBe('A job was assigned to you');
    expect(store.snapshot().members.find((member) => member.id === 'member_casey_harbor')?.status).toBe('offline');
  });

  it('resets an in-progress job when it is pulled off a technician', async () => {
    const { store, actor } = jordan();
    const moved = await store.reassignJob(actor, 'job_harbor_magnolia', 'member_casey_harbor');
    expect(moved.status).toBe('scheduled');
    expect(moved.startedAt).toBeNull();
    expect(store.snapshot().members.find((member) => member.id === 'member_luis_harbor')?.status).toBe('available');
  });

  it('switches the visible company with the membership', async () => {
    const store = repo();
    const harbor = store.actorFor('user_alex', 'org_harbor');
    const summit = store.actorFor('user_alex', 'org_summit');
    expect(harbor.role).toBe('technician');
    expect(summit.role).toBe('dispatcher');
    const denver = await store.listDispatchBoard(summit);
    expect(denver.technicians.map((person) => person.fullName)).toEqual(['Mina Alvarez', 'Chris Dalton']);
    await expect(store.getJob(summit, 'job_harbor_lila')).rejects.toMatchObject({ code: 'not_found' });
    expect(() => store.actorFor('user_alex', 'org_missing')).toThrow(JobflowError);
  });

  it('rejects a second payment and a note from outside the workspace', async () => {
    const { store, actor } = alex();
    await expect(store.collectPayment(actor, 'job_harbor_elena', { method: 'cash', amountCents: 100 })).rejects.toMatchObject({
      code: 'conflict',
    });
  });
});
