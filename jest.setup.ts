jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('SafeAreaView', null, children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  Redirect: () => null,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('expo-router/js-tabs', () => ({
  Tabs: Object.assign(() => null, { Screen: () => null }),
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const Mock = ({ children }: { children?: React.ReactNode }) => React.createElement('Svg', null, children);
  return { __esModule: true, default: Mock, Svg: Mock, Circle: Mock, Rect: Mock, Path: Mock, G: Mock, Line: Mock, Polyline: Mock };
});
