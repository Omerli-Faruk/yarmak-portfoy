import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import {AuthProvider} from "@/context/AuthContext";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Portföy Takip",
    description: "Portföy takip etmenize yardımcı olan site",
};

export default function RootLayout({children}: LayoutProps<"/">) {
    return (
        <html
            lang="tr"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
        <body className="min-h-full flex flex-col"><AuthProvider>{children}</AuthProvider></body>
        </html>
    );
}
