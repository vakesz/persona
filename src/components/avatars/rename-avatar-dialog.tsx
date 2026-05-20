import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
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
import type { Id } from '@convex/_generated/dataModel';

export interface RenameAvatarDialogProps {
  avatarId: Id<'avatars'> | null;
  currentName: string;
  onClose: () => void;
}

export function RenameAvatarDialog({ avatarId, currentName, onClose }: RenameAvatarDialogProps) {
  const updateAvatar = useMutation(api.avatars.updateAvatar);
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(currentName);
  }, [currentName, avatarId]);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (avatarId === null) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error('Name is required.');
      return;
    }
    setSubmitting(true);
    updateAvatar({ id: avatarId, name: trimmed })
      .then(() => {
        toast.success('Renamed.');
        onClose();
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Could not rename.');
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
      ariaLabel="Rename avatar"
    >
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Rename avatar</DialogTitle>
          <DialogDescription>Give this avatar a name you&apos;ll recognize.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-2">
            <Label htmlFor="avatar-name">Name</Label>
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
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || name.trim() === currentName}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
