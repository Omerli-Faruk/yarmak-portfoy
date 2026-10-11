import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Navbar ve Footer da 1280px kullanır; sayfa kenarı üst çubukla hizalı kalsın diye default ve wide aynıdır
const WIDTH_CLASSES = {
    narrow: 'max-w-3xl',       // yasal metinler, profil, giriş formları
    default: 'max-w-[1280px]',
    wide: 'max-w-[1280px]',
} as const;

export interface PageContainerProps {
    width?: keyof typeof WIDTH_CLASSES;
    className?: string;
    children: ReactNode;
}

// Sayfa gövdesi. Bölümler arasını boşluk ayırır (mobilde 32px, masaüstünde 40px); çerçeve gerekmez.
// Mobil alt sekme çubuğunun boşluğunu Footer bıraktığı için burada ek boşluk gerekmez.
export default function PageContainer({ width = 'default', className, children }: PageContainerProps) {
    return (
        <div className={cn('mx-auto flex w-full flex-col gap-8 lg:gap-10 px-4 sm:px-6 pt-6 pb-10 sm:pt-8 sm:pb-14', WIDTH_CLASSES[width], className)}>
            {children}
        </div>
    );
}
