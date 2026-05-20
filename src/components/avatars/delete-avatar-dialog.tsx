import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export interface DeleteAvatarDialogProps {
  avatarId: Id<'avatars'> | null;
  avatarName: string;
  onClose: () => void;
}

export function DeleteAvatarDialog({ avatarId, avatarName, onClose }: DeleteAvatarDialogProps) {
  const deleteAvatar = useMutation(api.avatars.deleteAvatar);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = () => {
    if (avatarId === null) return;
    setSubmitting(true);
    deleteAvatar({ id: avatarId })
      .then(() => {
        toast.success('Avatar deleted.');
        onClose();
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Could not delete.');
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
      ariaLabel="Delete avatar"
    >
      <DialogHeader>
        <DialogTitle>Delete {avatarName}?</DialogTitle>
        <DialogDescription>
          This removes the avatar and every saved look, render, and try-on tied to it. The original
          photos and renders are deleted from storage too. This can&apos;t be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <p className="text-muted-foreground text-sm">
          Uploaded clothing items aren&apos;t tied to a specific avatar, so those stay.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={handleConfirm} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Delete avatar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
