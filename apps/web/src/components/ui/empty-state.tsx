import { cn } from '@/lib/utils';
import {
  Inbox,
  XCircle,
  LoaderCircle,
  CheckCircle2,
} from 'lucide-react';

const variants = {
  empty: {
    icon: Inbox,
    title: 'Chưa có dữ liệu',
    text: 'Nội dung mới sẽ xuất hiện tại đây.',
    iconClass: 'text-muted-foreground',
  },
  error: {
    icon: XCircle,
    title: 'Không thể tải dữ liệu',
    text: 'Vui lòng kiểm tra kết nối và thử lại.',
    iconClass: 'text-destructive',
  },
  loading: {
    icon: LoaderCircle,
    title: 'Đang tải dữ liệu',
    text: 'Chỉ mất vài giây thôi...',
    iconClass: 'animate-spin text-primary',
  },
  success: {
    icon: CheckCircle2,
    title: 'Hoàn tất!',
    text: 'Thao tác của bạn đã được lưu thành công.',
    iconClass: 'text-green-500',
  },
} as const;

interface EmptyStateProps {
  type?: keyof typeof variants;
  title?: string;
  text?: string;
  icon?: React.ElementType;
  className?: string;
}

export function EmptyState({
  type = 'empty',
  title,
  text,
  icon: CustomIcon,
  className,
}: EmptyStateProps) {
  const variant = variants[type];
  const Icon = CustomIcon ?? variant.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center py-10 text-center text-muted-foreground',
        className,
      )}
    >
      <Icon className={cn('h-7 w-7', variant.iconClass)} />
      <p className="mt-2 text-sm font-semibold text-foreground">
        {title ?? variant.title}
      </p>
      <p className="mt-1 text-xs">{text ?? variant.text}</p>
    </div>
  );
}
