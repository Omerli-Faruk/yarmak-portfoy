import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PageContainer from '@/components/ui/PageContainer';
import Section from '@/components/ui/Section';

// Yasal metinlerin (kullanım şartları, gizlilik, yasal uyarı) ortak iskeleti ve yazı sınıfları

// Yasal metin uzun okunur: 16px, rahat satır aralığı, tam kontrastlı yazı
export const legalTextClass = 'text-base leading-7 text-fg';
export const legalListClass = 'flex flex-col gap-2 pl-4 list-disc marker:text-fg-subtle ' + legalTextClass;
export const legalInlineLinkClass =
    'rounded text-primary underline underline-offset-2 transition-colors duration-[120ms] hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const navLinkClass =
    'inline-flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded text-fg-muted transition-colors duration-[120ms] hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// Tek madde: kutusuz bölüm, display başlık. Maddeler arasını boşluk ayırır.
export function LegalSection({ id, title, children }: { id?: string; title: ReactNode; children: ReactNode }) {
    return (
        <Section id={id} title={title} contentClassName="gap-3" className="scroll-mt-20">
            {children}
        </Section>
    );
}

interface LegalDocumentProps {
    title: ReactNode;
    intro: ReactNode;
    updated: { dateTime: string; label: string };
    children: ReactNode;
}

// Diğer yasal metinlerin bağlantıları hemen alttaki Footer'da durduğu için sayfada tekrar edilmez.
export default function LegalDocument({ title, intro, updated, children }: LegalDocumentProps) {
    return (
        <PageContainer width="narrow">
            <div className="mx-auto flex w-full max-w-[680px] flex-col gap-10 sm:gap-12">
                <div className="flex flex-col gap-4">
                    <Link href="/" className={navLinkClass + ' self-start text-sm'}>
                        <ArrowLeft className="size-4" aria-hidden />
                        Ana sayfaya dön
                    </Link>

                    {/* Başlık: sayfanın tek odak noktası */}
                    <header className="flex flex-col gap-4">
                        <h1 className="font-display text-[1.875rem] font-bold leading-[1.15] tracking-display text-fg sm:text-title">
                            {title}
                        </h1>
                        <p className="text-base leading-7 text-fg-muted">{intro}</p>
                        <p className="text-sm text-fg-muted">
                            Son güncelleme: <time dateTime={updated.dateTime} className="font-mono">{updated.label}</time>
                        </p>
                    </header>
                </div>

                <article className="flex flex-col gap-10 [&_strong]:font-semibold [&_strong]:text-fg">{children}</article>
            </div>
        </PageContainer>
    );
}
