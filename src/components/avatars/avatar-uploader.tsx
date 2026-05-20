import { useMutation } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { type ChangeEvent, type ReactNode, type SyntheticEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { processAvatarImage } from '@/lib/image-compression';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type AvatarType = 'selfie' | 'full_body';
type Status = 'idle' | 'compressing' | 'uploading' | 'saving';

export interface AvatarUploaderProps {
  onCreated: (id: Id<'avatars'>) => void;
}

export function AvatarUploader({ onCreated }: AvatarUploaderProps) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createAvatar = useMutation(api.avatars.createAvatar);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AvatarType>('selfie');
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (file === null) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const busy = status !== 'idle';

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.currentTarget.files?.[0] ?? null);
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file === null) {
      toast.error('Pick a photo first.');
      return;
    }
    void uploadAndCreate(file);
  };

  async function uploadOne(blob: File): Promise<Id<'_storage'>> {
    const url = await generateUploadUrl();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': blob.type },
      body: blob,
    });
    if (!response.ok) {
      throw new Error('Upload failed.');
    }
    const json = (await response.json()) as { storageId: Id<'_storage'> };
    return json.storageId;
  }

  async function uploadAndCreate(picked: File) {
    try {
      setStatus('compressing');
      const { base, thumbnail } = await processAvatarImage(picked);

      setStatus('uploading');
      const [baseImageStorageId, thumbnailStorageId] = await Promise.all([
        uploadOne(base),
        uploadOne(thumbnail),
      ]);

      setStatus('saving');
      const avatarId = await createAvatar({
        name,
        type,
        baseImageStorageId,
        thumbnailStorageId,
      });
      toast.success('Avatar created.');
      onCreated(avatarId);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Something went wrong.');
      setStatus('idle');
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="photo">Photo</Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              disabled={busy}
              required
              onChange={handleFileChange}
            />
            <p className="text-muted-foreground text-xs">
              Compressed and EXIF-stripped in your browser before upload.
            </p>
          </div>

          {previewUrl !== null && (
            <div className="bg-muted overflow-hidden rounded-lg">
              <img
                src={previewUrl}
                alt="Selected photo preview"
                className="aspect-[4/5] size-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
              placeholder="e.g. Weekend me"
              disabled={busy}
              required
              maxLength={40}
            />
          </div>

          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="mb-2 text-sm font-medium">Photo type</legend>
            <div className="grid grid-cols-2 gap-2">
              <TypeOption value="selfie" selected={type === 'selfie'} onSelect={setType}>
                Selfie
              </TypeOption>
              <TypeOption value="full_body" selected={type === 'full_body'} onSelect={setType}>
                Full body
              </TypeOption>
            </div>
          </fieldset>

          <Button type="submit" disabled={busy || file === null}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {statusLabel(status)}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface TypeOptionProps {
  value: AvatarType;
  selected: boolean;
  onSelect: (value: AvatarType) => void;
  children: ReactNode;
}

function TypeOption({ value, selected, onSelect, children }: TypeOptionProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(value);
      }}
      aria-pressed={selected}
      className={cn(
        'rounded-md border px-4 py-2 text-sm transition',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-input hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

function statusLabel(status: Status): string {
  switch (status) {
    case 'compressing':
      return 'Compressing…';
    case 'uploading':
      return 'Uploading…';
    case 'saving':
      return 'Saving avatar…';
    case 'idle':
      return 'Create avatar';
  }
}
