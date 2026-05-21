import { useAuthActions } from '@convex-dev/auth/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { toast } from 'sonner';

import { clearStoredLocale } from '@/i18n/detect';
import { useToastMutation } from '@/i18n/use-toast-mutation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@convex/_generated/api';

const CONFIRMATION_PHRASE = 'delete my account';

export interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { t } = useLingui();
  const deleteAccount = useToastMutation(api.users.deleteAccount, {
    successMessage: t`Account deleted.`,
  });
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmation.trim().toLowerCase() !== CONFIRMATION_PHRASE) {
      toast.error(t`Type "${CONFIRMATION_PHRASE}" to confirm.`);
      return;
    }
    void deleteAccount.run({}).then(async (result) => {
      if (result === undefined) return;
      // Wipe the cached locale so the next user on this browser doesn't
      // inherit ours.
      clearStoredLocale();
      try {
        await signOut();
      } catch (error) {
        console.warn('Sign-out after delete-account failed (expected — user row is gone):', error);
      }
      await navigate({ to: '/' });
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!deleteAccount.pending) onOpenChange(next);
      }}
      ariaLabel={t`Delete account`}
    >
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>
            <Trans>Delete your account?</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              This deletes every avatar, saved look, render, uploaded item, and the storage blobs
              behind them. It also removes your user record. There&apos;s no undo.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Label htmlFor="confirmation">
            <Trans>
              Type <span className="font-mono">{CONFIRMATION_PHRASE}</span> to confirm
            </Trans>
          </Label>
          <Input
            id="confirmation"
            type="text"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.currentTarget.value);
            }}
            autoFocus
            disabled={deleteAccount.pending}
            autoComplete="off"
          />
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={deleteAccount.pending}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={
              deleteAccount.pending || confirmation.trim().toLowerCase() !== CONFIRMATION_PHRASE
            }
          >
            {deleteAccount.pending ? <Loader2 className="animate-spin" /> : null}
            <Trans>Delete account</Trans>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
