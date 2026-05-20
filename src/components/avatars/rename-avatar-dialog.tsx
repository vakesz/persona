import { Trans, useLingui } from '@lingui/react/macro';
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
import type { Id } from '@convex/_generated/dataModel';

export interface RenameAvatarDialogProps {
  avatarId: Id<'avatars'> | null;
  currentName: string;
  onClose: () => void;
}

// Parent supplies `key={avatarId ?? 'closed'}` so this component remounts on
// each open — that way `useState(currentName)` always starts from the latest
// name without a derived-state effect.
export function RenameAvatarDialog({ avatarId, currentName, onClose }: RenameAvatarDialogProps) {
  const updateAvatar = useMutation(api.avatars.updateAvatar);
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLingui();

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (avatarId === null) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error(t`Name is required.`);
      return;
    }
    setSubmitting(true);
    updateAvatar({ id: avatarId, name: trimmed })
      .then(() => {
        toast.success(t`Renamed.`);
        onClose();
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(translateServerError(error));
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <Dialog
      open={avatarId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      ariaLabel={t`Rename avatar`}
    >
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>
            <Trans>Rename avatar</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Give this avatar a name you&apos;ll recognize.</Trans>
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2">
            <Label htmlFor="avatar-name">
              <Trans>Name</Trans>
            </Label>
            <Input
              id="avatar-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
              autoFocus
              required
              maxLength={40}
              disabled={submitting}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit" disabled={submitting || name.trim() === currentName}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            <Trans>Save</Trans>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
