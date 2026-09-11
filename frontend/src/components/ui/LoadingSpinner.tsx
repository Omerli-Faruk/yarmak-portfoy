import React from "react";
import Image from "next/image";

interface LoadingSpinnerProps {
    message?: string;
    withLogo?: boolean;
    fullScreen?: boolean;
}

export default function LoadingSpinner({ message, withLogo = false, fullScreen = true }: LoadingSpinnerProps) {
    const containerClasses = fullScreen
        ? "min-h-screen flex flex-col items-center justify-center space-y-4"
        : "w-full h-full flex flex-col items-center justify-center space-y-4 py-12";

    return (
        <div className={containerClasses}>
            {withLogo && (
                <Image src="/logo.png" alt="Yarmak Logo" width={80} height={80} className="size-20 object-contain" loading="eager" />
            )}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            {message && <p className="text-slate-400 font-medium text-center">{message}</p>}
        </div>
    );
}
