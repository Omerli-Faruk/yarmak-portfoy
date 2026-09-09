import React from 'react';
import { motion } from 'motion/react';
import { featureCards } from '@/data/homeData';

export default function FeatureCardsSection() {
    return (
        <section id="ozellikler" className="w-full max-w-6xl mx-auto px-4 py-24 border-t border-white/5 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            
            <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Portföyünüz İçin Gelişmiş Araçlar</h2>
                <p className="text-slate-400 max-w-2xl mx-auto">Profesyonel portföy yöneticilerinin kullandığı araçları bireysel yatırımcılar için basitleştirdik.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {featureCards.map((feat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                        className="bg-surface border border-border/80 rounded-2xl p-6 sm:p-8 hover:border-primary/50 transition-colors group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <feat.icon className="w-10 h-10 text-primary mb-5 group-hover:scale-110 transition-transform duration-300" />
                        <h3 className="text-lg font-bold text-white mb-3">{feat.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
