import { useMutation } from 'convex/react';
import { Loader2, Plus } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { toast } from 'sonner';

import { processAvatarImage } from '@/lib/image-compression';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export interface UploadedItemUploaderProps {
  onUploaded: (id: Id<'uploadedItems'>) => void;
}

export function UploadedItemUploader({ onUploaded }: UploadedItemUploaderProps) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createUploadedItem = useMutation(api.uploadedItems.createUploadedItem);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0];
    if (picked === undefined) return;
    void upload(picked);
    // Reset so the same file can be re-selected if the upload failed.
    event.currentTarget.value = '';
  };

  async function upload(picked: File) {
    setBusy(true);
    try {
      const { base } = await processAvatarImage(picked);
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': base.type },
        body: base,
      });
      if (!response.ok) {
        throw new Error('Upload failed.');
      }
      const json = (await response.json()) as { storageId: Id<'_storage'> };
      const id = await createUploadedItem({
        type: 'dress',
        imageStorageId: json.storageId,
        label: stripExt(picked.name),
      });
      toast.success('Upload added.');
      onUploaded(id);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not upload.');
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
        className="border-border hover:border-foreground/40 flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-2 text-center transition disabled:opacity-50"
      >
        <div className="bg-muted text-muted-foreground flex h-16 w-full items-center justify-center rounded">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        </div>
        <span className="text-xs leading-tight">Upload</span>
      </button>
    </>
  );
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}
