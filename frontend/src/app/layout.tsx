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
        default: "Yarmak | Akıllı Borsa & Portföy Takip Terminali",
        template: "%s | Yarmak",
    },
    description: "Borsa İstanbul (BIST) hisseleri, TEFAS yatırım fonları ve altın portföyünüzü canlı, dolar bazlı ve kuruşu kuruşuna doğru takip edin.",
    keywords: [
        "BIST portföy takip",
        "TEFAS fon takibi",
        "hisse senedi kar zarar",
        "borsa portföy yönetimi",
        "temettü takibi",
        "ağırlıklı ortalama maliyet",
        "Yarmak",
    ],
    authors: [{ name: "Yarmak Portföy" }],
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
            <div className="min-h-screen flex flex-col bg-ambient-spotlight">
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
