import type {Metadata, Viewport} from "next";
import {Inter_Tight, Space_Grotesk} from "next/font/google";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";
import {ThemeProvider} from "@/components/ui/ThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {THEME_BG, THEME_INIT_SCRIPT} from "@/lib/theme";

// Arayüz yazısı ve rakamlar Inter Tight (rakamlar sabit genişlikte), başlıklar ve büyük değerler Space Grotesk.
// Türkçe harfler (ğ, ş, İ) için latin-ext de yüklenir.
// globals.css bu değişkenlerden --font-sans, --font-mono ve --font-display'i (font-sans / font-mono / font-display) üretir.
const interTight = Inter_Tight({
    variable: "--font-inter-tight",
    subsets: ["latin", "latin-ext"],
    display: "swap",
});

const spaceGrotesk = Space_Grotesk({
    variable: "--font-space-grotesk",
    weight: ["500", "700"],
    subsets: ["latin", "latin-ext"],
    display: "swap",
});


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
            className={`${interTight.variable} ${spaceGrotesk.variable} h-full antialiased`}
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
