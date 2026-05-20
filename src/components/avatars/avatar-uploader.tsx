import { useMutation } from 'convex/react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  type ChangeEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
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

const MAX_PHOTOS = 5;

interface PickedPhoto {
  /** Stable id for React keys + remove. */
  id: string;
  file: File;
  previewUrl: string;
}

export interface AvatarUploaderProps {
  onCreated: (id: Id<'avatars'>) => void;
}

export function AvatarUploader({ onCreated }: AvatarUploaderProps) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createAvatar = useMutation(api.avatars.createAvatar);

  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<AvatarType>('selfie');
  const [status, setStatus] = useState<Status>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Owned-URL ledger — every call to URL.createObjectURL is registered here so
  // we can revoke any survivors on unmount. Handlers below add/remove entries
  // alongside the photo state.
  const liveUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = liveUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const busy = status !== 'idle';

  const addPickedFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    setPhotos((prev) => {
      const remaining = MAX_PHOTOS - prev.length;
      if (remaining <= 0) {
        toast.error(`At most ${MAX_PHOTOS} photos.`);
        return prev;
      }
      const accepted = incoming.slice(0, remaining).map<PickedPhoto>((file) => {
        const previewUrl = URL.createObjectURL(file);
        liveUrlsRef.current.add(previewUrl);
        return { id: crypto.randomUUID(), file, previewUrl };
      });
      if (incoming.length > remaining) {
        toast.error(`Only the first ${MAX_PHOTOS} photos are used.`);
      }
      return [...prev, ...accepted];
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.currentTarget.files ?? []);
    addPickedFiles(incoming);
    event.currentTarget.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed !== undefined) {
        URL.revokeObjectURL(removed.previewUrl);
        liveUrlsRef.current.delete(removed.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (photos.length === 0) {
      toast.error('Pick at least one photo.');
      return;
    }
    void uploadAndCreate();
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

  async function uploadAndCreate() {
    try {
      setStatus('compressing');
      // First photo also yields the thumbnail; the rest are full-resolution sources.
      const first = photos[0];
      if (first === undefined) throw new Error('No photo selected.');
      const firstProcessed = await processAvatarImage(first.file);
      const restProcessed = await Promise.all(
        photos.slice(1).map(async (photo) => (await processAvatarImage(photo.file)).base),
      );
      const baseFiles = [firstProcessed.base, ...restProcessed];

      setStatus('uploading');
      const [sourcePhotoStorageIds, thumbnailStorageId] = await Promise.all([
        Promise.all(baseFiles.map((blob) => uploadOne(blob))),
        uploadOne(firstProcessed.thumbnail),
      ]);

      setStatus('saving');
      const avatarId = await createAvatar({
        name,
        type,
        sourcePhotoStorageIds,
        thumbnailStorageId,
      });
      toast.success('Avatar created. Generating your studio portrait…');
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
            <Label htmlFor="photo">
              Photos ({photos.length} of {MAX_PHOTOS})
            </Label>
            <input
              ref={fileInputRef}
              id="photo"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={busy}
              onChange={handleFileChange}
            />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((photo, index) => (
                <PhotoTile
                  key={photo.id}
                  previewUrl={photo.previewUrl}
                  index={index}
                  disabled={busy}
                  onRemove={() => {
                    removePhoto(photo.id);
                  }}
                />
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="border-input hover:border-foreground/40 flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-md border border-dashed transition disabled:opacity-50"
                >
                  <Plus className="text-muted-foreground size-5" />
                  <span className="text-muted-foreground text-xs">
                    {photos.length === 0 ? 'Add photo' : 'Add another'}
                  </span>
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              First photo becomes the front reference. Extra angles (¾ left / right, full body) help
              the AI preserve your identity. Each photo is compressed and EXIF-stripped in your
              browser before upload.
            </p>
          </div>

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

          <Button type="submit" disabled={busy || photos.length === 0}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {statusLabel(status)}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface PhotoTileProps {
  previewUrl: string;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}

function PhotoTile({ previewUrl, index, disabled, onRemove }: PhotoTileProps) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-md">
      <img
        src={previewUrl}
        alt={`Selected photo ${(index + 1).toString()}`}
        className="size-full object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove photo ${(index + 1).toString()}`}
        className="bg-background/80 absolute top-1 right-1 rounded-full p-1 shadow disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
      {index === 0 && (
        <span className="bg-foreground/80 text-background absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
          Front
        </span>
      )}
    </div>
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
