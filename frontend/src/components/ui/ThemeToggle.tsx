'use client';

import { Moon, Sun } from 'lucide-react';
import IconButton from './IconButton';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className }: { className?: string }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <IconButton
            icon={isDark ? <Sun /> : <Moon />}
            label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
            size="sm"
            onClick={toggleTheme}
            className={className}
        />
    );
}
