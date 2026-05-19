import { Construction } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ComingSoonProps {
  title: string;
  phase: string;
  description: string;
}

/** Placeholder panel for features scheduled in later build phases. */
export function ComingSoon({ title, phase, description }: ComingSoonProps) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Construction className="text-muted-foreground size-5" />
          {title}
        </CardTitle>
        <CardDescription>Planned for {phase}.</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">{description}</CardContent>
    </Card>
  );
}
