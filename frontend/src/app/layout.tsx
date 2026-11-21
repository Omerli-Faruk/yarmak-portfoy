import type {Metadata, Viewport} from "next";
// Yazı tipleri npm paketinden (fontsource) gelir, derlemede ağa çıkılmaz. Eskiden next/font/google derleme
// anında Google'dan indiriyordu; Google'ın o anki cevabı bozuk gelince CI kırılıyordu (#57).
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";
import {ThemeProvider} from "@/components/ui/ThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {THEME_BG, THEME_INIT_SCRIPT} from "@/lib/theme";


export const metadata: Metadata = {
    title: {
        default: "Yarmak | Hisse, Fon ve Altın Portföy Takibi",
        template: "%s | Yarmak",
    },
    description: "Borsa İstanbul hisseleri, TEFAS fonları, altın ve döviz yatırımlarınızı tek yerden takip edin; ortalama maliyetinizi, kâr/zararınızı ve temettülerinizi görün.",
    keywords: [
        "BIST portföy takip",
        "TEFAS fon takibi",
        "hisse senedi kar zarar",
        "borsa portföy yönetimi",
        "temettü takibi",
        "ağırlıklı ortalama maliyet",
        "Yarmak",
    ],
    authors: [{ name: "Yarmak" }],
    icons: {
        icon: "/logo.png",
        apple: "/logo.png",
    },
};

// Mobil tarayıcı çubuğu sistem temasına göre renklenir
export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: THEME_BG.light },
        { media: "(prefers-color-scheme: dark)", color: THEME_BG.dark },
    ],
};

export default function RootLayout({children}: LayoutProps<"/">) {
    return (
        <html
            lang="tr"
            className="h-full antialiased"
            suppressHydrationWarning
        >
        <head>
            {/* Tema, sayfa boyanmadan önce uygulanır (açılışta yanıp sönme olmasın diye) */}
            <script dangerouslySetInnerHTML={{__html: THEME_INIT_SCRIPT}}/>
        </head>
        <body className="min-h-full flex flex-col bg-bg font-sans text-fg">
        <ThemeProvider>
            <AuthProvider>
                <div className="min-h-screen flex flex-col bg-ambient-spotlight">
                    <Navbar />
                    <main className="flex-1 flex flex-col">
                        {children}
                    </main>
                    <Footer/>
                </div>
            </AuthProvider>
        </ThemeProvider>
        </body>
        </html>
    );
}
