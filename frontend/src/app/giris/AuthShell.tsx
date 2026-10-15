import type { ReactNode } from 'react';
import Image from 'next/image';

// Metin içi bağlantı (yasal metinler, onay kutuları)
export const authLinkClass =
    'rounded text-fg underline decoration-border-strong underline-offset-2 transition-colors duration-[120ms] hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// Şifre alanının sağındaki göster/gizle düğmesi
export const authToggleClass =
    '-mr-2.5 flex size-11 sm:size-10 items-center justify-center rounded text-fg-muted transition-colors duration-[120ms] hover:bg-surface-3 hover:text-fg cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary [&_svg]:size-5';

// Formun altındaki "diğer ekrana geç" bağlantısı
export const authSwitchLinkClass =
    'inline-flex min-h-11 sm:min-h-10 items-center rounded font-medium text-primary transition-colors duration-[120ms] hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// Not maddeleri yasal metinlerden aynen alınmıştır. Başlıklar bağlantı değildir;
// yasal metinlere giden bağlantılar formun altında bir kez yer alır.
const NOTES = [
    {
        title: 'Banka ve aracı kurum şifreniz istenmez',
        text: 'Portföyünüzdeki işlem ve temettü kayıtları yalnızca sizin elle girdiğiniz bilgilerden oluşur; fiyatlar piyasa veri kaynaklarından alınır.',
    },
    {
        title: 'Şifre ve oturum güvenliği',
        text: 'Kullanıcı şifreleri veritabanında açık metin olarak tutulmaz; bcrypt ile geri çözülemeyecek şekilde saklanır.',
    },
    {
        title: 'Veri gecikmesi ve fon fiyatları',
        text: 'Borsa İstanbul (BIST) pay piyasası verileri en az 15 dakika gecikmelidir.',
    },
];

interface AuthShellProps {
    title: ReactNode;    // ekranın tek odak noktası: büyük display başlık
    subtitle?: ReactNode;
    footer: ReactNode;   // formun altındaki satır: diğer ekrana bağlantı
    children: ReactNode; // form paneline girer
}

// Giriş ve kayıt ekranlarının ortak iskeleti.
// Solda büyük başlık (masaüstünde altında sade bilgi notları), sağda ekrandaki tek kutu olan form paneli.
export default function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
    return (
        <div className="flex flex-1 justify-center px-4 pt-6 pb-10 sm:px-6 sm:py-12 md:items-center">
            <div className="flex w-full max-w-[420px] flex-col gap-8 md:max-w-[920px] md:flex-row md:items-center md:gap-16">
                {/* Başlık ve bilgi notları */}
                <div className="flex min-w-0 flex-col gap-10 md:basis-0 md:grow">
                    <div className="flex flex-col gap-6">
                        {/* Marka yalnızca işaret; ana sayfa bağlantısı üst çubuktaki "Ana sayfa" düğmesinde bir kez yer alır */}
                        <div className="flex items-center gap-2 self-start">
                            <Image src="/logo.png" alt="" width={24} height={24} className="size-6 object-contain" />
                            <span className="font-display text-lg font-bold tracking-tight text-fg">yarmak</span>
                        </div>
                        <div className="flex flex-col gap-3">
                            <h1 className="font-display text-[1.875rem] font-bold leading-[1.1] tracking-display text-fg sm:text-title">
                                {title}
                            </h1>
                            {subtitle && <p className="text-base text-fg-muted">{subtitle}</p>}
                        </div>
                    </div>

                    {/* Bilgi notları: yalnızca masaüstünde, kutusuz düz metin */}
                    <ul aria-label="Kişisel Verilerin Korunması" className="hidden flex-col gap-5 md:flex">
                        {NOTES.map((note) => (
                            <li key={note.title} className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-fg">{note.title}</span>
                                <p className="max-w-[46ch] text-sm leading-relaxed text-fg-muted">{note.text}</p>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Form paneli */}
                <div className="flex min-w-0 flex-col gap-4 md:w-[400px] md:shrink-0">
                    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-5 sm:p-6">
                        {children}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">{footer}</p>
                </div>
            </div>
        </div>
    );
}
