import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
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
import type { FunctionReturnType } from 'convex/server';

type UploadedItemType = FunctionReturnType<
  typeof api.uploadedItems.listUploadedItems
>[number]['type'];

const UPLOAD_TYPE_OPTIONS: { value: UploadedItemType; label: MessageDescriptor }[] = [
  { value: 'dress', label: msg`Dress` },
  { value: 'top', label: msg`Top` },
  { value: 'shoes', label: msg`Shoes` },
  { value: 'nails_reference', label: msg`Nails reference` },
  { value: 'hair_reference', label: msg`Hair reference` },
];

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
  const [selectedType, setSelectedType] = useState<UploadedItemType>('dress');
  const { i18n, t } = useLingui();

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
        type: selectedType,
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
      <div className="border-border flex aspect-square w-full flex-col gap-1 rounded-md border border-dashed p-2">
        <label
          htmlFor="upload-item-type"
          className="text-muted-foreground text-[11px] leading-none"
        >
          <Trans>Type</Trans>
        </label>
        <select
          id="upload-item-type"
          value={selectedType}
          disabled={busy}
          onChange={(event) => {
            setSelectedType(event.currentTarget.value as UploadedItemType);
          }}
          className="border-input bg-background text-foreground rounded-md border px-2 py-1 text-xs"
        >
          {UPLOAD_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {i18n._(option.label)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          className="border-border hover:border-foreground/40 flex flex-1 flex-col items-center justify-center gap-2 rounded-md border p-2 text-center transition disabled:opacity-50"
        >
          <div className="bg-muted text-muted-foreground flex h-10 w-full items-center justify-center rounded">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
          </div>
          <span className="text-xs leading-tight">
            <Trans>Upload</Trans>
          </span>
        </button>
      </div>
    </>
  );
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}
