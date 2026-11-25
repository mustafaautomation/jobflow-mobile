import { alwaysOnline } from '@/data/connectivity';
import { bootMock } from '@/controller/memory-controller';
import { memoryKv } from '@/storage/kv';

describe('mock auth', () => {
  it('opens the demo as a technician and switches into the dispatcher seat', async () => {
    const controller = await bootMock(memoryKv(), alwaysOnline());
    await controller.enterDemo('alex');
    expect(controller.getSnapshot().actor?.fullName).toBe('Alex Rivera');
    expect(controller.getSnapshot().actor?.role).toBe('technician');
    await controller.switchOrganization('org_summit');
    expect(controller.getSnapshot().actor?.role).toBe('dispatcher');
    expect(controller.getSnapshot().actor?.organizationName).toBe('Summit Mechanical');
  });

  it('signs in with a magic link and rejects an unknown inbox', async () => {
    const storage = memoryKv();
    const controller = await bootMock(storage, alwaysOnline());
    await controller.sendMagicLink('jordan.hale@harborpine.demo');
    const token = controller.getSnapshot().pendingMagicLink?.devToken;
    expect(token).toBeTruthy();
    await controller.consumeMagicLink(token ?? '');
    expect(controller.getSnapshot().actor?.role).toBe('dispatcher');

    const again = await bootMock(storage, alwaysOnline());
    expect(again.getSnapshot().actor?.email).toBe('jordan.hale@harborpine.demo');

    await controller.signOut();
    await controller.sendMagicLink('nobody@example.com');
    const bad = controller.getSnapshot().pendingMagicLink?.devToken ?? '';
    await expect(controller.consumeMagicLink(bad)).rejects.toMatchObject({ code: 'auth' });
    expect(controller.getSnapshot().actor).toBeNull();
  });
});
