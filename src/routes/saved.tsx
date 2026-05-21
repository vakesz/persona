import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Trash2, User, UserSquare2 } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';

import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

interface SavedSearch {
  avatarId?: Id<'avatars'>;
}

export const Route = createFileRoute('/saved')({
  validateSearch: (search: Record<string, unknown>): SavedSearch => {
    const raw = search['avatarId'];
    return typeof raw === 'string' ? { avatarId: raw as Id<'avatars'> } : {};
  },
  component: SavedLooksPage,
});

function SavedLooksPage() {
  return (
    <RequireAuth>
      <SavedLooks />
    </RequireAuth>
  );
}

interface SavedLookRow {
  _id: Id<'savedLooks'>;
  avatarId: Id<'avatars'>;
  renderUrl: string | null;
  metadataJson: string | undefined;
}

interface AvatarRow {
  _id: Id<'avatars'>;
  name: string;
  type: 'selfie' | 'full_body';
  thumbnailUrl: string | null;
}

function SavedLooks() {
  const search = Route.useSearch();
  const focusAvatarId = search.avatarId;
  const { t } = useLingui();

  const avatars = useQuery(api.avatars.listAvatars);
  const looks = useQuery(api.savedLooks.listSavedLooks, {});
  const deleteLook = useMutation(api.savedLooks.deleteSavedLook);

  const handleDelete = (id: Id<'savedLooks'>) => {
    deleteLook({ id }).catch((error: unknown) => {
      console.error(error);
      toast.error(t`Could not delete look.`);
    });
  };

  const grouped = useMemo(() => groupByAvatar(avatars, looks), [avatars, looks]);

  if (avatars === undefined || looks === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  const totalLooks = looks.length;
  const visibleGroups =
    focusAvatarId === undefined ? grouped : grouped.filter((g) => g.avatar._id === focusAvatarId);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            <Trans>Saved looks</Trans>
          </h1>
          <p className="text-muted-foreground text-sm">
            <Trans>
              Organized per avatar. You can save as many looks as you like for each persona.
            </Trans>
          </p>
        </div>
        {avatars.length > 0 && (
          <nav className="flex flex-wrap gap-1.5" aria-label={t`Filter by avatar`}>
            <FilterChip
              to="/saved"
              search={{}}
              active={focusAvatarId === undefined}
              label={t`All (${totalLooks.toString()})`}
            />
            {grouped.map((group) => (
              <FilterChip
                key={group.avatar._id}
                to="/saved"
                search={{ avatarId: group.avatar._id }}
                active={focusAvatarId === group.avatar._id}
                label={`${group.avatar.name} (${group.looks.length.toString()})`}
              />
            ))}
          </nav>
        )}
      </header>

      {totalLooks === 0 ? (
        <Card className="bg-card/40 border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">
            <Trans>No saved looks yet</Trans>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            <Trans>Open an avatar, render a look, then click Save.</Trans>
          </p>
          <Button asChild className="mt-5 w-fit self-center">
            <Link to="/avatars">
              <Trans>Choose</Trans>
            </Link>
          </Button>
        </Card>
      ) : visibleGroups.length === 0 ? (
        <Card className="bg-card/40 border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">
            <Trans>No looks for this avatar yet</Trans>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            <Trans>Render and save a look from the studio to start a gallery here.</Trans>
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {visibleGroups.map((group) => (
            <AvatarLookSection
              key={group.avatar._id}
              avatar={group.avatar}
              looks={group.looks}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  to: '/saved';
  search: SavedSearch;
  active: boolean;
  label: string;
}

function FilterChip({ to, search, active, label }: FilterChipProps) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

interface AvatarLookSectionProps {
  avatar: AvatarRow;
  looks: SavedLookRow[];
  onDelete: (id: Id<'savedLooks'>) => void;
}

function AvatarLookSection({ avatar, looks, onDelete }: AvatarLookSectionProps) {
  if (looks.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-muted size-10 shrink-0 overflow-hidden rounded-full">
            {avatar.thumbnailUrl === null ? (
              <div className="text-muted-foreground flex size-full items-center justify-center">
                {avatar.type === 'selfie' ? (
                  <User className="size-5" />
                ) : (
                  <UserSquare2 className="size-5" />
                )}
              </div>
            ) : (
              <img
                src={avatar.thumbnailUrl}
                alt={avatar.name}
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold">{avatar.name}</h2>
            <p className="text-muted-foreground text-xs">
              <Plural value={looks.length} one="# look" other="# looks" />
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/studio/$avatarId" params={{ avatarId: avatar._id }}>
            <Trans>Open studio</Trans>
          </Link>
        </Button>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {looks.map((look) => (
          <SavedLookCard
            key={look._id}
            renderUrl={look.renderUrl}
            metadataJson={look.metadataJson}
            onDelete={() => {
              onDelete(look._id);
            }}
          />
        ))}
      </div>
    </section>
  );
}

interface SavedLookCardProps {
  renderUrl: string | null;
  metadataJson: string | undefined;
  onDelete: () => void;
}

function SavedLookCard({ renderUrl, metadataJson, onDelete }: SavedLookCardProps) {
  const { t } = useLingui();
  const title = parseTitle(metadataJson) ?? t`Look`;
  return (
    <Card className="group hover:border-primary/40 hover:shadow-primary/5 overflow-hidden p-0 transition hover:shadow-md">
      <div className="bg-muted aspect-[4/5] w-full overflow-hidden">
        {renderUrl === null ? (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
            <Trans>Image missing</Trans>
          </div>
        ) : (
          <img
            src={renderUrl}
            alt={title}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="truncate text-sm font-medium">{title}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete} aria-label={t`Delete`}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

function parseTitle(metadataJson: string | undefined): string | null {
  if (metadataJson === undefined) return null;
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
  return null;
}

interface AvatarLookGroup {
  avatar: AvatarRow;
  looks: SavedLookRow[];
}

function groupByAvatar(
  avatars: AvatarRow[] | undefined,
  looks: SavedLookRow[] | undefined,
): AvatarLookGroup[] {
  if (avatars === undefined || looks === undefined) return [];
  const byAvatar = new Map<string, SavedLookRow[]>();
  for (const look of looks) {
    const bucket = byAvatar.get(look.avatarId) ?? [];
    bucket.push(look);
    byAvatar.set(look.avatarId, bucket);
  }
  return avatars
    .map((avatar) => ({ avatar, looks: byAvatar.get(avatar._id) ?? [] }))
    .filter((group) => group.looks.length > 0);
}
