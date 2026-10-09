import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
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

export default function RootLayout({children}: LayoutProps<"/">) {
    return (
        <html
            lang="tr"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
        <body className="min-h-full flex flex-col">
        <AuthProvider>
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex flex-col">
                    {children}
                </main>
                <Footer/>
            </div>
        </AuthProvider>
        </body>
        </html>
    );
}
