import { useAuthActions } from '@convex-dev/auth/react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { toast } from 'sonner';

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

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmation.trim().toLowerCase() !== CONFIRMATION_PHRASE) {
      toast.error(`Type "${CONFIRMATION_PHRASE}" to confirm.`);
      return;
    }
    setSubmitting(true);
    deleteAccount({})
      .then(async () => {
        toast.success('Account deleted.');
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
        toast.error(error instanceof Error ? error.message : 'Could not delete account.');
        setSubmitting(false);
      });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
      ariaLabel="Delete account"
    >
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This deletes every avatar, saved look, render, uploaded item, and the storage blobs
            behind them. It also removes your user record. There&apos;s no undo.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Label htmlFor="confirmation">
            Type <span className="font-mono">{CONFIRMATION_PHRASE}</span> to confirm
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
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={submitting || confirmation.trim().toLowerCase() !== CONFIRMATION_PHRASE}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Delete account
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
