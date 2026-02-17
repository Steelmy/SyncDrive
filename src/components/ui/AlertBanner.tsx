import { AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react';

type BannerVariant = 'info' | 'warning' | 'error' | 'success';

interface AlertBannerProps {
  variant: BannerVariant;
  title?: string;
  children: React.ReactNode;
}

const variantConfig: Record<BannerVariant, { bg: string; text: string; icon: typeof Info }> = {
  info:    { bg: 'bg-blue-50',   text: 'text-blue-800',  icon: Info },
  warning: { bg: 'bg-amber-50',  text: 'text-amber-800', icon: AlertTriangle },
  error:   { bg: 'bg-red-50',    text: 'text-red-800',   icon: AlertCircle },
  success: { bg: 'bg-green-50',  text: 'text-green-800', icon: CheckCircle }
};

export default function AlertBanner({ variant, title, children }: AlertBannerProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className={`p-3 ${config.bg} rounded-lg`}>
      <div className="flex items-start">
        <Icon className={`h-4 w-4 ${config.text} mr-2 mt-0.5 flex-shrink-0`} />
        <div className={`text-sm ${config.text}`}>
          {title && <p className="font-medium mb-1">{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
