import { useRouter } from 'expo-router';
import { AccountView } from '@/features/account/AccountView';
import { useAppState } from '@/controller/provider';

export default function AccountRoute() {
  const router = useRouter();
  const { controller } = useAppState();
  return (
    <AccountView
      onOrganizationChanged={() => {
        setTimeout(() => {
          const role = controller?.getSnapshot().actor?.role;
          router.replace(role === 'technician' ? '/today' : '/board');
        }, 0);
      }}
      onSignedOut={() => router.replace('/welcome')}
    />
  );
}
