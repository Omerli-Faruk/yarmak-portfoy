import { cn } from '@/lib/cn';

// Tablo ve liste başlıklarının ortak görünümü: sayfadan kopuk durmasın diye hafif zeminli, köşeleri yuvarlak bir bant.
// Başlık ve satırlar aynı yatay iç boşluğu (px-3) kullanır; böylece sütunlar alt alta hizalı kalır ve
// satırın hover zemini yazıya yapışmaz.

// Flex ile kurulan listelerin başlık satırı (görünürlük için hidden md:flex gibi sınıfları className ile verin)
export function tableHeadRowClasses(className?: string): string {
    return cn('flex items-center h-10 px-3 rounded bg-surface-2 text-xs font-medium text-fg-muted', className);
}

// <table> başlık hücresi: yapışkan bant; ilk ve son hücre bandın köşelerini yuvarlar
export const TABLE_TH =
    'sticky top-0 z-10 h-10 px-3 bg-surface-2 text-xs font-medium text-fg-muted whitespace-nowrap first:rounded-l last:rounded-r';
