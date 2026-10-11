'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { faqItems } from '@/data/homeData';
import Section from '@/components/ui/Section';
import { cn } from '@/lib/cn';

// Sıkça sorulan sorular: kalın bölüm başlığı, altında kutusuz açılır liste
export default function FaqSection() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <Section
            id="destek"
            title="Sıkça sorulan sorular"
            className="scroll-mt-16"
        >
            <div className="flex flex-col divide-y divide-border border-y border-border">
                {faqItems.map((faq, idx) => {
                    const isOpen = openFaq === idx;
                    const panelId = `sss-yanit-${idx}`;
                    return (
                        <div key={idx} className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => setOpenFaq(isOpen ? null : idx)}
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                className={cn(
                                    '-mx-2 flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded px-2 py-2.5 text-left',
                                    'transition-colors duration-[120ms] hover:bg-surface-2',
                                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                                )}
                            >
                                <span className="text-base font-medium text-fg">{faq.question}</span>
                                <ChevronDown
                                    aria-hidden
                                    className={cn('size-5 shrink-0 text-fg-muted', isOpen && 'rotate-180 text-fg')}
                                />
                            </button>
                            {isOpen && (
                                <div id={panelId} className="max-w-[72ch] pb-4 pt-1 text-base leading-relaxed text-fg-muted">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Section>
    );
}
