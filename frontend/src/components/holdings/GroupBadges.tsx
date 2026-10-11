import React from 'react';
import type { AssetGroup } from '@/types';

// Varlığın atandığı gruplar: çerçevesiz kısa etiketler, grup rengi yalnızca noktada.
// Grup rengi kullanıcının seçtiği veridir; yazı iki temada da okunsun diye tema rengiyle yazılır.
export default function GroupBadges({ groups }: { groups: AssetGroup[] }) {
    return (
        <>
            {groups.map(g => (
                <span
                    key={g.id}
                    className="inline-flex items-center gap-1.5 shrink-0 min-h-6 pr-2 text-sm text-fg whitespace-nowrap"
                >
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                    {g.name}
                </span>
            ))}
        </>
    );
}
