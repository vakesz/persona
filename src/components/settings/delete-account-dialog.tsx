import { useAuthActions } from '@convex-dev/auth/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { toast } from 'sonner';

import { translateServerError } from '@/i18n/server-errors';
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
  const deleteAccount = useMutation(api.users.deleteAccount);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLingui();

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmation.trim().toLowerCase() !== CONFIRMATION_PHRASE) {
      toast.error(t`Type "${CONFIRMATION_PHRASE}" to confirm.`);
      return;
    }
    setSubmitting(true);
    deleteAccount({})
      .then(async () => {
        toast.success(t`Account deleted.`);
        try {
          await signOut();
        } catch (error) {
          console.warn(
            'Sign-out after delete-account failed (expected — user row is gone):',
            error,
          );
        }
        await navigate({ to: '/' });
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(translateServerError(error));
        setSubmitting(false);
      });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
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
            disabled={submitting}
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
            disabled={submitting}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={submitting || confirmation.trim().toLowerCase() !== CONFIRMATION_PHRASE}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            <Trans>Delete account</Trans>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
