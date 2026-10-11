'use client';

import React, { useId, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';

// Yeni grup için seçilebilen renkler; ilki varsayılan. Bunlar tema rengi değil, gruba kaydedilen
// kullanıcı verisidir (localStorage'da saklanır, etiket noktalarında kullanılır).
const AVAILABLE_COLORS = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#8b5cf6',
    '#06b6d4',
    '#3b82f6',
    '#ef4444',
];

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateGroup: (name: string, color: string) => void;
}

export default function CreateGroupModal({
    isOpen,
    onClose,
    onCreateGroup,
}: CreateGroupModalProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(AVAILABLE_COLORS[0]);
    const formId = useId();
    const nameId = useId();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreateGroup(name.trim(), color);
        setName('');
        setColor(AVAILABLE_COLORS[0]);
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Yeni grup"
            footer={
                <>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        İptal
                    </Button>
                    <Button type="submit" form={formId} size="sm">
                        Oluştur
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Field label="Grup adı" htmlFor={nameId}>
                    <Input
                        id={nameId}
                        type="text"
                        required
                        autoFocus
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="örn. Temettü Portföyüm, Teknoloji, Uzun Vade"
                    />
                </Field>

                <Field label="Renk">
                    <div role="radiogroup" aria-label="Grup rengi" className="flex flex-wrap items-center gap-2">
                        {AVAILABLE_COLORS.map((c, i) => {
                            const isSelected = color === c;
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={`Renk ${i + 1}`}
                                    onClick={() => setColor(c)}
                                    className={cn(
                                        'flex items-center justify-center size-11 sm:size-10 rounded cursor-pointer',
                                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                        isSelected ? 'outline-2 outline-offset-2 outline-fg' : 'hover:opacity-80',
                                    )}
                                    style={{ backgroundColor: c }}
                                >
                                    {isSelected && <Check className="size-5 text-on-primary" aria-hidden />}
                                </button>
                            );
                        })}
                    </div>
                </Field>
            </form>
        </Modal>
    );
}
