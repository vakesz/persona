import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export const Route = createFileRoute('/saved')({
  component: SavedLooksPage,
});

function SavedLooksPage() {
  return (
    <RequireAuth>
      <SavedLooks />
    </RequireAuth>
  );
}

interface SavedLook {
  _id: Id<'savedLooks'>;
  _creationTime: number;
  avatarId: Id<'avatars'>;
  metadataJson: string | undefined;
  renderUrl: string | null;
}

function SavedLooks() {
  const looks = useQuery(api.savedLooks.listSavedLooks, {});
  const deleteLook = useMutation(api.savedLooks.deleteSavedLook);

  const handleDelete = (id: Id<'savedLooks'>) => {
    deleteLook({ id }).catch((error: unknown) => {
      console.error(error);
      toast.error('Could not delete look.');
    });
  };

  if (looks === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Saved looks</h1>
        <p className="text-muted-foreground text-sm">
          AI-rendered looks you&apos;ve saved. {looks.length} so far.
        </p>
      </header>

      {looks.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <h2 className="text-lg font-medium">No saved looks yet</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Render a recommendation in the stylist and save it here.
          </p>
          <Button asChild className="mt-4">
            <Link to="/avatars">Choose an avatar</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {looks.map((look: SavedLook) => (
            <SavedLookCard
              key={look._id}
              renderUrl={look.renderUrl}
              metadataJson={look.metadataJson}
              onDelete={() => {
                handleDelete(look._id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SavedLookCardProps {
  renderUrl: string | null;
  metadataJson: string | undefined;
  onDelete: () => void;
}

function SavedLookCard({ renderUrl, metadataJson, onDelete }: SavedLookCardProps) {
  const title = parseTitle(metadataJson);
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-muted aspect-[4/5] w-full overflow-hidden">
        {renderUrl === null ? (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
            Image missing
          </div>
        ) : (
          <img
            src={renderUrl}
            alt={title}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="truncate text-sm font-medium">{title}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete} aria-label="Delete">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

function parseTitle(metadataJson: string | undefined): string {
  if (metadataJson === undefined) return 'Look';
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'title' in parsed &&
      typeof parsed.title === 'string' &&
      parsed.title.length > 0
    ) {
      return parsed.title;
    }
  } catch {
    // fall through
  }
  return 'Look';
}
