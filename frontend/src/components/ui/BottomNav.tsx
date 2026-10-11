'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, BriefcaseBusiness, ChartCandlestick, Layers } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
    { href: '/dashboard', label: 'Portföy', icon: BriefcaseBusiness },
    { href: '/holdings', label: 'Varlıklar', icon: Layers },
    { href: '/markets', label: 'Piyasalar', icon: ChartCandlestick },
    { href: '/alerts', label: 'Alarmlar', icon: Bell },
];

// Mobilde giriş yapmış kullanıcı için alt sekme çubuğu (sm ve üstünde gizli). Etkin sekmenin üstünde ince mavi çizgi.
export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Ana menü"
            className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
            {TABS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname?.startsWith(`${href}/`);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'relative flex flex-1 flex-col items-center justify-center gap-1 h-16 text-xs font-medium transition-colors duration-[120ms]',
                            'focus-visible:outline-none focus-visible:bg-surface-2',
                            isActive ? 'text-primary' : 'text-fg-muted hover:text-fg',
                        )}
                    >
                        {isActive && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 bg-primary" />}
                        <Icon className="size-5" aria-hidden />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
