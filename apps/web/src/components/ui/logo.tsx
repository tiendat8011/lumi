import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#2563eb] via-[#4f46e5] to-[#06b6d4] shadow-[0_6px_15px_rgba(37,99,235,0.25)]">
        <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-xl font-extrabold tracking-tight">Lumi</span>
    </div>
  );
}
