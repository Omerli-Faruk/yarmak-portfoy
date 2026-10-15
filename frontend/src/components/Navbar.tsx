'use client'

import Link from "next/link";
import {useAuth} from "@/context/AuthContext";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ui/ThemeToggle';
import IconButton from '@/components/ui/IconButton';
import BottomNav from '@/components/ui/BottomNav';
import { buttonClasses } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

// Giriş yapmış kullanıcının menüsü
const USER_LINKS = [
    { href: '/portfoy', label: 'Portföyüm' },
    { href: '/varliklar', label: 'Varlıklarım' },
    { href: '/piyasalar', label: 'Piyasalar' },
    { href: '/alarmlar', label: 'Alarmlar' },
];

// Ziyaretçi menüsü; # ile başlayanlar ana sayfadaki bölümlere gider
const GUEST_LINKS = [
    { href: '/piyasalar', label: 'Piyasalar' },
    { href: '/#ozellikler', label: 'Özellikler' },
    { href: '/#destek', label: 'Destek' },
];

function isLinkActive(pathname: string | null, href: string): boolean {
    if (!pathname || href.includes('#')) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
    const {user, logOut} = useAuth();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    if (pathname?.startsWith("/giris") || pathname?.startsWith("/kayit")) {
        return (
            <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 pt-4">
                <Link href="/" className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2' })}>
                    <ArrowLeft /> Ana sayfa
                </Link>
                <ThemeToggle />
            </header>
        )
    }

    const navLinks = user ? USER_LINKS : GUEST_LINKS;
    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <header className="w-full relative z-40 border-b border-border">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-stretch justify-between gap-4">
                <div className="flex items-stretch gap-8 min-w-0">
                    <Link
                        className="flex items-center gap-2 shrink-0 self-center min-h-11 sm:min-h-10 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        href={user ? "/portfoy" : "/"}
                    >
                        <Image src="/logo.png" alt="Yarmak Logo" width={28} height={28} className="size-7 object-contain" loading="eager"/>
                        <span className="font-display text-xl font-bold tracking-tight text-fg">yarmak</span>
                    </Link>

                    {/* Masaüstü menü: metin sekmeleri, etkin olanın altında mavi çizgi */}
                    <nav className="hidden md:flex items-stretch gap-6" aria-label="Ana menü">
                        {navLinks.map(link => {
                            const isActive = isLinkActive(pathname, link.href);
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={cn(
                                        'relative flex items-center text-sm font-medium transition-colors duration-[120ms]',
                                        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                                        isActive ? 'text-fg' : 'text-fg-muted hover:text-fg',
                                    )}
                                >
                                    {link.label}
                                    {isActive && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Sağ taraf. Bildirim çanı her genişlikte tek kez render edilir:
                    masaüstünde [tema][çan][kullanıcı][çıkış], mobilde [tema][çan][menü düğmesi]. */}
                <div className="flex items-center justify-end gap-1">
                    <ThemeToggle />
                    {user && <NotificationBell />}

                    <div className="hidden md:flex items-center gap-1">
                        {user ? (
                            <>
                                {/* Dar masaüstünde yalnızca simge görünür; kullanıcı adı ekran okuyucuya yine okunur */}
                                <Link
                                    href="/profil"
                                    title="Profil"
                                    className="flex items-center gap-2 h-10 px-2.5 rounded text-sm font-medium text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    <UserRound className="size-[18px]" aria-hidden />
                                    <span className="sr-only lg:not-sr-only max-w-40 truncate">{user.username}</span>
                                </Link>
                                <IconButton
                                    size="sm"
                                    icon={<LogOut />}
                                    label="Çıkış yap"
                                    onClick={() => logOut()}
                                    className="hover:text-loss"
                                />
                            </>
                        ) : (
                            <>
                                <Link href="/giris" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                                    Giriş yap
                                </Link>
                                <Link href="/kayit" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                                    Ücretsiz kaydol
                                </Link>
                            </>
                        )}
                    </div>

                    <IconButton
                        className="md:hidden"
                        size="sm"
                        icon={isMobileMenuOpen ? <X /> : <Menu />}
                        label="Menü"
                        active={isMobileMenuOpen}
                        aria-expanded={isMobileMenuOpen}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    />
                </div>
            </div>

            {/* Mobil menü */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-16 inset-x-4 z-50 mt-1 flex flex-col p-1 bg-surface border border-border rounded-md md:hidden"
                    >
                        {/* Giriş yapılmışsa sayfa bağlantıları dar ekranda alt sekme çubuğunda durur */}
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={closeMobileMenu}
                                className={cn(
                                    'items-center h-12 px-3 rounded text-base font-medium transition-colors duration-[120ms]',
                                    user ? 'hidden sm:flex' : 'flex',
                                    isLinkActive(pathname, link.href) ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg hover:bg-surface-2',
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className={cn('h-px bg-border my-1', user && 'hidden sm:block')} />
                        {user ? (
                            <div className="flex items-center justify-between gap-2">
                                <Link
                                    href="/profil"
                                    onClick={closeMobileMenu}
                                    className="flex items-center gap-2 h-12 px-3 rounded text-base font-medium text-fg hover:bg-surface-2 min-w-0"
                                >
                                    <UserRound className="size-[18px] text-fg-subtle shrink-0" aria-hidden />
                                    <span className="truncate">{user.username}</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => { logOut(); closeMobileMenu(); }}
                                    className="flex items-center gap-2 h-12 px-3 rounded text-base font-medium text-loss hover:bg-loss-soft transition-colors duration-[120ms] cursor-pointer"
                                >
                                    <LogOut className="size-[18px]" aria-hidden /> Çıkış
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5 p-1">
                                <Link href="/giris" onClick={closeMobileMenu} className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
                                    Giriş yap
                                </Link>
                                <Link href="/kayit" onClick={closeMobileMenu} className={buttonClasses({ variant: 'primary', fullWidth: true })}>
                                    Ücretsiz kaydol
                                </Link>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {user && <BottomNav />}
        </header>
    );
}
