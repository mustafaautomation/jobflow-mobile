import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAppState } from '@/controller/provider';
import { useActor, useRepository, useSubscribed } from '@/features/data-hooks';
import { errorMessage } from '@/domain/errors';
import { formatMoney, formatTimeRange, invoiceLabel, statusLabel } from '@/domain/format';
import { mapsPinUrl, phoneUrl } from '@/domain/geo';
import {
  actionLabel,
  availableActions,
  canAddPhoto,
  canCollectPayment,
  canEditChecklist,
  canMarkInvoiced,
  canReassign,
  canSign,
  canTransition,
} from '@/domain/permissions';
import { scriptSignature } from '@/domain/signature';
import type { JobAction, Stroke } from '@/domain/types';
import { pickLibraryPhoto, stampUri } from '@/media/photos';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  InvoicePill,
  Kicker,
  LoadingState,
  Muted,
  RowLink,
  Screen,
  StatusPill,
  TextField,
  Title,
  UrgentTag,
} from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { SignaturePad } from '@/features/job/SignaturePad';

export function JobDetailView({
  jobId,
  onBack,
  onOpen,
  onOpenUrl,
}: {
  jobId: string;
  onBack: () => void;
  onOpen: (path: 'checklist' | 'photos' | 'notes' | 'signature' | 'payment') => void;
  onOpenUrl: (url: string) => void;
}) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.getJob(actor, jobId) : Promise.reject(new Error('Sign in to open this job.'))),
    actor ? `job:${jobId}:${actor.organizationId}` : jobId,
  );
  const board = useSubscribed(
    () => (actor && repo && canReassign(actor) ? repo.listDispatchBoard(actor) : Promise.resolve(null)),
    actor ? `reassign:${actor.organizationId}:${actor.role}` : 'none',
  );

  async function run(action: JobAction) {
    if (!actor || !repo) return;
    setPending(true);
    setError(null);
    try {
      await repo.transitionJob(actor, jobId, action);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function reassign(memberId: string) {
    if (!actor || !repo) return;
    setPending(true);
    setError(null);
    try {
      await repo.reassignJob(actor, jobId, memberId);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <Screen>
        <LoadingState label="Loading the job" />
      </Screen>
    );
  }
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState message={state.message} onRetry={retry} />
        <Button label="Back" onPress={onBack} tone="quiet" />
      </Screen>
    );
  }

  const job = state.data;
  const actions = actor && canTransition(actor, job.assignedMemberId) ? availableActions(job.status) : [];
  const requiredOpen = job.checklist.filter((item) => item.required && !item.completed).length;
  const techs = board.state.status === 'ready' ? board.state.data?.technicians ?? [] : [];

  return (
    <Screen testID="job-screen">
      <Button label="Back" onPress={onBack} tone="quiet" testID="job-back" />
      <View style={styles.pills}>
        <StatusPill status={job.status} />
        <UrgentTag priority={job.priority} />
        <InvoicePill status={job.invoiceStatus} />
      </View>
      <Kicker>{job.service}</Kicker>
      <Title>{job.title}</Title>
      <Muted>{formatTimeRange(job.scheduledStart, job.scheduledEnd)}</Muted>
      <Card>
        <Text style={[styles.customer, { color: colors.ink }]}>{job.customerName}</Text>
        <Muted>{job.locationLabel}</Muted>
        <Text style={[styles.address, { color: colors.ink }]}>{job.addressLine}</Text>
        <Muted>{job.locality}</Muted>
        <View style={styles.actions}>
          <Button label="Call" tone="secondary" onPress={() => onOpenUrl(phoneUrl(job.customerPhone))} testID="job-call" />
          <Button
            label="Open in Maps"
            onPress={() => onOpenUrl(mapsPinUrl({ lat: job.lat, lng: job.lng }, `${job.addressLine}, ${job.locality}`))}
            testID="job-maps"
          />
        </View>
      </Card>
      <Muted>{job.summary}</Muted>
      {job.assigneeName ? <Muted>Assigned to {job.assigneeName}</Muted> : <Muted>Unassigned</Muted>}
      {requiredOpen > 0 && actions.includes('complete') ? (
        <Muted>
          {requiredOpen} required {requiredOpen === 1 ? 'check is' : 'checks are'} still open. You can still complete the job.
        </Muted>
      ) : null}
      {error ? <Text style={{ color: colors.danger, fontFamily: 'Outfit_500Medium' }}>{error}</Text> : null}
      {actions.map((action) => (
        <Button
          key={action}
          label={pending ? 'Saving…' : actionLabel(action)}
          onPress={() => void run(action)}
          disabled={pending}
          tone={action === 'pause' ? 'secondary' : 'primary'}
          testID={action === 'start_travel' ? 'job-start-travel' : action === 'start' ? 'job-start' : action === 'pause' ? 'job-pause' : action === 'resume' ? 'job-resume' : 'job-complete'}
        />
      ))}
      <RowLink
        title="Checklist"
        detail={`${job.checklist.filter((item) => item.completed).length} of ${job.checklist.length} done`}
        onPress={() => onOpen('checklist')}
        testID="open-checklist"
      />
      <RowLink title="Photos" detail={`${job.photos.length} attached`} onPress={() => onOpen('photos')} testID="open-photos" />
      <RowLink title="Notes" detail={`${job.notes.length} notes`} onPress={() => onOpen('notes')} testID="open-notes" />
      <RowLink
        title="Signature"
        detail={job.signature ? `Signed by ${job.signature.signerName}` : 'Not signed'}
        onPress={() => onOpen('signature')}
        testID="open-signature"
      />
      <RowLink
        title="Payment"
        detail={`${formatMoney(job.amountCents)} · ${invoiceLabel(job.invoiceStatus)}`}
        onPress={() => onOpen('payment')}
        testID="open-payment"
      />
      {actor && canReassign(actor) && job.status !== 'completed' && job.status !== 'cancelled' ? (
        <Card>
          <Text style={[styles.customer, { color: colors.ink }]}>Reassign</Text>
          {techs.map((person) => (
            <Button
              key={person.memberId}
              label={person.memberId === job.assignedMemberId ? `${person.fullName} · current` : `Assign to ${person.fullName}`}
              tone="secondary"
              disabled={pending || person.memberId === job.assignedMemberId}
              onPress={() => void reassign(person.memberId)}
              testID={`reassign-${person.memberId}`}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

export function ChecklistView({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.getJob(actor, jobId) : Promise.reject(new Error('Sign in to open this job.'))),
    `chk:${jobId}:${actor?.organizationId ?? ''}`,
  );
  if (state.status === 'loading') return <Screen><LoadingState label="Loading the checklist" /></Screen>;
  if (state.status === 'error') return <Screen><ErrorState message={state.message} onRetry={retry} /></Screen>;
  const job = state.data;
  const editable = Boolean(actor && canEditChecklist(actor, job.assignedMemberId, job.status));
  return (
    <Screen testID="checklist-screen">
      <Button label="Back" onPress={onBack} tone="quiet" />
      <Title>Checklist</Title>
      {!editable ? <Muted>The assigned technician checks these off.</Muted> : null}
      {job.checklist.length === 0 ? <EmptyState title="No checklist" body="This job has no steps yet." /> : null}
      {job.checklist.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.completed, disabled: !editable }}
          accessibilityLabel={item.label}
          disabled={!editable}
          testID={`check-${item.id}`}
          onPress={() => actor && repo && void repo.toggleChecklistItem(actor, jobId, item.id, !item.completed)}
          style={[styles.check, { borderColor: colors.line, backgroundColor: colors.bgElevated }]}
        >
          <View style={[styles.box, { borderColor: colors.primary, backgroundColor: item.completed ? colors.primary : 'transparent' }]} />
          <View style={styles.flex}>
            <Text style={{ color: colors.ink, fontFamily: 'Outfit_500Medium', fontSize: 16 }}>{item.label}</Text>
            <Muted>{item.required ? 'Required' : 'Optional'}</Muted>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

export function PhotosView({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.getJob(actor, jobId) : Promise.reject(new Error('Sign in to open this job.'))),
    `photos:${jobId}:${actor?.organizationId ?? ''}`,
  );
  if (state.status === 'loading') return <Screen><LoadingState label="Loading photos" /></Screen>;
  if (state.status === 'error') return <Screen><ErrorState message={state.message} onRetry={retry} /></Screen>;
  const job = state.data;
  const editable = Boolean(actor && canAddPhoto(actor, job.assignedMemberId, job.status));

  async function stamp() {
    if (!actor || !repo) return;
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    await repo.addPhoto(actor, jobId, { uri: stampUri(jobId), caption: `Field photo · ${time}` });
  }

  async function library() {
    const uri = await pickLibraryPhoto();
    if (!uri) {
      setMessage('The photo library is unavailable. Stamp a field photo instead.');
      return;
    }
    if (!actor || !repo) return;
    await repo.addPhoto(actor, jobId, { uri, caption: 'From the library' });
  }

  return (
    <Screen testID="photos-screen">
      <Button label="Back" onPress={onBack} tone="quiet" />
      <Title>Photos</Title>
      {editable ? <Button label="Stamp field photo" onPress={() => void stamp()} testID="stamp-photo" /> : <Muted>Only the assigned technician adds photos.</Muted>}
      {editable ? <Button label="Choose from library" tone="secondary" onPress={() => void library()} testID="library-photo" /> : null}
      {message ? <Muted>{message}</Muted> : null}
      {job.photos.length === 0 ? <EmptyState title="No photos yet" body="Stamp the condenser, the coil, or the nameplate before you leave." /> : null}
      {job.photos.map((photo) => (
        <View key={photo.id} style={[styles.photo, { backgroundColor: colors.bgElevated, borderColor: colors.line }]} testID={`photo-${photo.id}`}>
          {photo.uri.startsWith('stamp://') ? <FieldStamp caption={photo.caption} /> : <Muted>Library photo attached</Muted>}
          <Text style={{ color: colors.ink, fontFamily: 'Outfit_600SemiBold' }}>{photo.caption}</Text>
        </View>
      ))}
    </Screen>
  );
}

export function NotesView({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.getJob(actor, jobId) : Promise.reject(new Error('Sign in to open this job.'))),
    `notes:${jobId}:${actor?.organizationId ?? ''}`,
  );
  if (state.status === 'loading') return <Screen><LoadingState label="Loading notes" /></Screen>;
  if (state.status === 'error') return <Screen><ErrorState message={state.message} onRetry={retry} /></Screen>;
  const job = state.data;

  async function save() {
    if (!actor || !repo) return;
    try {
      await repo.addNote(actor, jobId, body);
      setBody('');
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen testID="notes-screen">
      <Button label="Back" onPress={onBack} tone="quiet" />
      <Title>Notes</Title>
      <TextField label="Note" value={body} onChangeText={setBody} placeholder="What did you find?" testID="note-input" multiline />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label="Save note" onPress={() => void save()} testID="note-save" />
      {job.notes.length === 0 ? <EmptyState title="No notes yet" body="Leave what the next tech, or the office, needs to know." /> : null}
      {job.notes.map((note) => (
        <Card key={note.id}>
          <Text style={{ color: colors.ink, fontFamily: 'Outfit_400Regular', fontSize: 16 }}>{note.body}</Text>
          <Muted>{note.authorName}</Muted>
        </Card>
      ))}
    </Screen>
  );
}

export function SignatureView({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.getJob(actor, jobId) : Promise.reject(new Error('Sign in to open this job.'))),
    `sig:${jobId}:${actor?.organizationId ?? ''}`,
  );
  if (state.status === 'loading') return <Screen><LoadingState label="Loading the signature" /></Screen>;
  if (state.status === 'error') return <Screen><ErrorState message={state.message} onRetry={retry} /></Screen>;
  const job = state.data;
  const editable = Boolean(actor && canSign(actor, job.assignedMemberId, job.status));

  async function save() {
    if (!actor || !repo) return;
    try {
      const drawn = strokes.some((stroke) => stroke.points.length > 1) ? strokes : scriptSignature(name);
      await repo.saveSignature(actor, jobId, { signerName: name, strokes: drawn });
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen testID="signature-screen">
      <Button label="Back" onPress={onBack} tone="quiet" />
      <Title>Signature</Title>
      {job.signature ? <Muted>Signed by {job.signature.signerName}. Saving again replaces it.</Muted> : <Muted>Have the customer sign, or type their name to apply a script signature.</Muted>}
      {editable ? (
        <>
          <TextField label="Customer name" value={name} onChangeText={setName} placeholder="Name on the work order" testID="signature-name" autoCapitalize="words" />
          <SignaturePad strokes={strokes} onChange={setStrokes} />
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <Button label="Save signature" onPress={() => void save()} testID="signature-apply" />
        </>
      ) : (
        <Muted>Only the assigned technician captures the signature.</Muted>
      )}
    </Screen>
  );
}

export function PaymentView({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { controller } = useAppState();
  const { colors } = useTheme();
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.getJob(actor, jobId) : Promise.reject(new Error('Sign in to open this job.'))),
    `pay:${jobId}:${actor?.organizationId ?? ''}`,
  );
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (state.status === 'loading') return <Screen><LoadingState label="Loading payment" /></Screen>;
  if (state.status === 'error') return <Screen><ErrorState message={state.message} onRetry={retry} /></Screen>;
  const job = state.data;
  const cents = amount.trim() ? Math.round(Number(amount) * 100) : job.amountCents;
  const canPay = Boolean(actor && canCollectPayment(actor, job.assignedMemberId, job.status) && job.invoiceStatus !== 'paid');
  const canInvoice = Boolean(actor && canMarkInvoiced(actor, job.assignedMemberId, job.status) && job.invoiceStatus === 'unbilled');

  async function collect(method: 'card' | 'cash') {
    if (!actor || !repo) return;
    try {
      await repo.collectPayment(actor, jobId, { method, amountCents: cents });
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen testID="payment-screen">
      <Button label="Back" onPress={onBack} tone="quiet" />
      <Kicker>{statusLabel(job.status)}</Kicker>
      <Title>{formatMoney(job.amountCents)}</Title>
      <Muted>
        {controller?.stripeConfigured
          ? 'Stripe test mode is connected. Card numbers stay on the web app; this phone records the collection.'
          : 'Demo ledger. Card 4242 4242 4242 4242 is the Stripe test card when the web app settles the payment. No secret key is stored here.'}
      </Muted>
      <InvoicePill status={job.invoiceStatus} />
      {job.payments.map((payment) => (
        <Card key={payment.id}>
          <Text style={{ color: colors.ink, fontFamily: 'Outfit_600SemiBold' }}>
            {formatMoney(payment.amountCents)} · {payment.method}
          </Text>
          <Muted>{payment.stripePaymentIntentId ?? payment.status}</Muted>
        </Card>
      ))}
      {canPay ? (
        <>
          <TextField label="Amount in dollars" value={amount} onChangeText={setAmount} placeholder={(job.amountCents / 100).toFixed(2)} testID="payment-amount" keyboardType="number-pad" />
          <Button label="Collect card payment" onPress={() => void collect('card')} testID="payment-card" />
          <Button label="Collect cash" tone="secondary" onPress={() => void collect('cash')} testID="payment-cash" />
        </>
      ) : null}
      {canInvoice ? <Button label="Mark invoiced" tone="secondary" onPress={() => actor && repo && void repo.markInvoiced(actor, jobId).catch((caught) => setError(errorMessage(caught)))} testID="payment-invoice" /> : null}
      {job.invoiceStatus === 'paid' ? <Muted>This job is paid.</Muted> : null}
      {job.invoiceStatus === 'invoiced' ? <Muted>Invoiced. The office is waiting on the customer.</Muted> : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}

function FieldStamp({ caption }: { caption: string }) {
  const { colors } = useTheme();
  return (
    <Svg width="100%" height={140} viewBox="0 0 320 140" accessibilityLabel={caption}>
      <Rect width="320" height="140" rx="12" fill={colors.bgSunken} />
      <Rect x="196" y="36" width="78" height="70" rx="6" fill={colors.primary} />
      <Circle cx="235" cy="70" r="16" fill={colors.accent} />
      <Path d="M28 108 L70 48 L112 108 Z" fill={colors.primary} />
      <Rect x="40" y="90" width="24" height="18" fill={colors.accent} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  customer: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26 },
  address: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  check: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2 },
  flex: { flex: 1 },
  photo: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
});
