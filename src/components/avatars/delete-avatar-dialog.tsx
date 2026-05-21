import { Trans, useLingui } from '@lingui/react/macro';
import { Loader2 } from 'lucide-react';

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
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export interface DeleteAvatarDialogProps {
  avatarId: Id<'avatars'> | null;
  avatarName: string;
  onClose: () => void;
}

export function DeleteAvatarDialog({ avatarId, avatarName, onClose }: DeleteAvatarDialogProps) {
  const { t } = useLingui();
  const deleteAvatar = useToastMutation(api.avatars.deleteAvatar, {
    successMessage: t`Avatar deleted.`,
  });

  const handleConfirm = () => {
    if (avatarId === null) return;
    void deleteAvatar.run({ id: avatarId }).then((result) => {
      if (result !== undefined) onClose();
    });
  };

  return (
    <Dialog
      open={avatarId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      ariaLabel={t`Delete avatar`}
    >
      <DialogHeader>
        <DialogTitle>
          <Trans>Delete {avatarName}?</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>
            This removes the avatar and every saved look, render, and try-on tied to it. The
            original photos and renders are deleted from storage too. This can&apos;t be undone.
          </Trans>
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <p className="text-muted-foreground text-sm">
          <Trans>
            Uploaded clothing items aren&apos;t tied to a specific avatar, so those stay.
          </Trans>
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={deleteAvatar.pending}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleConfirm}
          disabled={deleteAvatar.pending}
        >
          {deleteAvatar.pending ? <Loader2 className="animate-spin" /> : null}
          <Trans>Delete avatar</Trans>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
