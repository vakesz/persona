import { Link } from '@tanstack/react-router';
import { User, UserSquare2 } from 'lucide-react';

import { Card } from '@/components/ui/card';
import type { Id } from '@convex/_generated/dataModel';

export interface AvatarCardProps {
  id: Id<'avatars'>;
  name: string;
  type: 'selfie' | 'full_body';
  thumbnailUrl: string | null;
}

export function AvatarCard({ id, name, type, thumbnailUrl }: AvatarCardProps) {
  return (
    <Link
      to="/studio/$avatarId"
      params={{ avatarId: id }}
      className="focus-visible:ring-ring group rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="group-hover:border-foreground/30 overflow-hidden p-0 transition">
        <div className="bg-muted aspect-[4/5] w-full overflow-hidden">
          {thumbnailUrl === null ? (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              {type === 'selfie' ? (
                <User className="size-12" />
              ) : (
                <UserSquare2 className="size-12" />
              )}
            </div>
          ) : (
            <img
              src={thumbnailUrl}
              alt={name}
              className="size-full object-cover transition group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground text-xs">
            {type === 'selfie' ? 'Selfie' : 'Full body'}
          </span>
        </div>
      </Card>
    </Link>
  );
}
