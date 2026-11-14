import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

const toneClasses: Record<string, string> = {
  blue: 'tone-blue',
  violet: 'tone-violet',
  orange: 'tone-orange',
  cyan: 'tone-cyan',
  green: 'tone-green',
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: string;
  tone?: 'blue' | 'violet' | 'orange' | 'cyan' | 'green';
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  tone = 'blue',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('flex-row items-center gap-3 p-4', className)}>
      <div
        className={cn(
          'grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl',
          toneClasses[tone],
        )}
      >
        <Icon className="h-[21px] w-[21px]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {change && (
          <p className="text-xs font-semibold text-green-600">
            {change}
          </p>
        )}
      </div>
    </Card>
  );
}
