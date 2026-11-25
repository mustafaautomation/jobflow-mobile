import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/controller/provider';
import { bootMock } from '@/controller/memory-controller';
import { alwaysOnline } from '@/data/connectivity';
import { memoryKv } from '@/storage/kv';
import { WelcomeView } from '@/features/auth/AuthViews';
import { TodayView } from '@/features/today/TodayView';
import { BoardView } from '@/features/board/BoardView';
import { JobDetailView } from '@/features/job/JobViews';
import type { AppController } from '@/controller/types';
import type { ReactElement } from 'react';

async function renderApp(ui: ReactElement, controller: AppController) {
  return render(
    <SafeAreaProvider>
      <AppProvider controller={controller}>{ui}</AppProvider>
    </SafeAreaProvider>,
  );
}

describe('role screens', () => {
  it('offers the demo personas', async () => {
    const controller = await bootMock(memoryKv(), alwaysOnline());
    await renderApp(<WelcomeView onSignedIn={jest.fn()} onSignIn={jest.fn()} />, controller);
    await fireEvent.press(screen.getByTestId('welcome-try-demo'));
    expect(screen.getByTestId('persona-alex')).toBeTruthy();
    expect(screen.getByTestId('persona-jordan')).toBeTruthy();
  });

  it('lists the technician route and starts the urgent call', async () => {
    const controller = await bootMock(memoryKv(), alwaysOnline());
    await controller.enterDemo('alex');
    await renderApp(<TodayView onOpenJob={jest.fn()} />, controller);
    expect(await screen.findByText('Lila Nguyen')).toBeTruthy();
    await renderApp(
      <JobDetailView jobId="job_harbor_lila" onBack={jest.fn()} onOpen={jest.fn()} onOpenUrl={jest.fn()} />,
      controller,
    );
    await fireEvent.press(await screen.findByTestId('job-start'));
    expect(await screen.findByText('In progress')).toBeTruthy();
  });

  it('shows an empty day for a technician with no calls', async () => {
    const controller = await bootMock(memoryKv(), alwaysOnline());
    await controller.sendMagicLink('casey.nguyen@harborpine.demo');
    await controller.consumeMagicLink(controller.getSnapshot().pendingMagicLink?.devToken ?? '');
    await renderApp(<TodayView onOpenJob={jest.fn()} />, controller);
    expect(await screen.findByText('No stops today')).toBeTruthy();
  });

  it('shows technician status and an unassigned urgent job to dispatch', async () => {
    const controller = await bootMock(memoryKv(), alwaysOnline());
    await controller.enterDemo('jordan');
    await renderApp(<BoardView onOpenJob={jest.fn()} />, controller);
    expect(await screen.findByText('Priya Shah')).toBeTruthy();
    expect(screen.getByText('Mueller Branch Library')).toBeTruthy();
    expect(screen.getAllByText('En route').length).toBeGreaterThan(0);
  });
});
