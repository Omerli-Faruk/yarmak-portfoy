import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { faqItems } from '@/data/homeData';

export default function FaqSection() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <section id="destek" className="w-full max-w-3xl mx-auto px-4 py-24">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold text-white mb-4">Sıkça Sorulan Sorular</h2>
                <p className="text-slate-400">Merak ettiğiniz tüm detaylar burada.</p>
            </div>
            <div className="flex flex-col gap-4">
                {faqItems.map((faq, idx) => {
                    const isOpen = openFaq === idx;
                    return (
                        <div key={idx} className="bg-surface border border-border/80 rounded-2xl overflow-hidden transition-colors hover:border-border">
                            <button
                                onClick={() => setOpenFaq(isOpen ? null : idx)}
                                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                            >
                                <span className="font-semibold text-slate-200">{faq.question}</span>
                                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="px-6 pb-5 text-sm text-slate-400 leading-relaxed"
                                    >
                                        <div className="pt-2 border-t border-border/50 mt-2">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
