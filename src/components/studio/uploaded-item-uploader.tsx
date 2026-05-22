import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation } from 'convex/react';
import { Loader2, Plus } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { toast } from 'sonner';

import { translateServerError } from '@/i18n/server-errors';
import { processAvatarImage } from '@/lib/image-compression';
import { uploadBlobToConvex } from '@/lib/storage/upload';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export interface UploadedItemUploaderProps {
  onUploaded: (id: Id<'uploadedItems'>) => void;
}

/**
 * Square "+ Upload" tile that triggers a file picker and uploads a clothing or
 * accessory reference into `uploadedItems`. Re-uses the existing avatar image
 * compression pipeline so EXIF + dimensions are stripped before upload.
 */
export function UploadedItemUploader({ onUploaded }: UploadedItemUploaderProps) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createUploadedItem = useMutation(api.uploadedItems.createUploadedItem);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useLingui();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0];
    if (picked === undefined) return;
    void upload(picked);
    event.currentTarget.value = '';
  };

  async function upload(picked: File) {
    setBusy(true);
    try {
      const { base } = await processAvatarImage(picked, { thumbnail: false });
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadBlobToConvex(uploadUrl, base, t`Upload failed.`);
      const id = await createUploadedItem({
        type: 'dress',
        imageStorageId: storageId,
        label: stripExt(picked.name),
      });
      toast.success(t`Upload added.`);
      onUploaded(id);
    } catch (error) {
      console.error(error);
      toast.error(translateServerError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="border-border hover:border-foreground/40 flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed p-2 text-center transition disabled:opacity-50"
      >
        <div className="bg-muted text-muted-foreground flex h-12 w-full items-center justify-center rounded">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        </div>
        <span className="text-xs leading-tight">
          <Trans>Upload</Trans>
        </span>
      </button>
    </>
  );
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}
