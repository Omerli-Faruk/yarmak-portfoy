import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Yarmak",
    description: "Akıllı Borsa & Portföy Takip Sistemi",
};

export default function RootLayout({children}: LayoutProps<"/">) {
    return (
        <html
            lang="tr"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
        <body className="min-h-full flex flex-col">
        <AuthProvider>

            <Navbar />

            <main className="flex-1">
                {children}
            </main>

        </AuthProvider>
        </body>
        </html>
    );
}
