import React from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

interface LoadingSpinnerProps {
    message?: string;
    withLogo?: boolean;
    fullScreen?: boolean;
}

export default function LoadingSpinner({ message, withLogo = false, fullScreen = true }: LoadingSpinnerProps) {
    return (
        <div
            role="status"
            className={cn(
                "flex flex-col items-center justify-center gap-3",
                fullScreen ? "min-h-[60vh]" : "w-full h-full py-10",
            )}
        >
            {withLogo && (
                <Image src="/logo.png" alt="Yarmak Logo" width={48} height={48} className="size-12 object-contain" loading="eager" />
            )}
            <div className="size-6 rounded-full border-2 border-surface-3 border-t-primary animate-spin" aria-hidden />
            {message ? (
                <p className="text-sm text-fg-muted text-center">{message}</p>
            ) : (
                <span className="sr-only">Yükleniyor</span>
            )}
        </div>
    );
}
