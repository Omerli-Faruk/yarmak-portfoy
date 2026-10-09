import React from 'react';
import type { AssetGroup } from '@/types';

// Varlığın atandığı grupların renkli etiketleri
export default function GroupBadges({ groups }: { groups: AssetGroup[] }) {
    return (
        <>
            {groups.map(g => (
                <span
                    key={g.id}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                    style={{
                        backgroundColor: `${g.color}15`,
                        color: g.color,
                        borderColor: `${g.color}35`,
                    }}
                >
                    <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: g.color }}
                    />
                    {g.name}
                </span>
            ))}
        </>
    );
}
