import React from 'react';
import { featureCards } from '@/data/homeData';

export default function FeatureCardsSection() {
    return (
        <section id="ozellikler" className="w-full max-w-6xl mx-auto px-4 py-24 border-t border-white/5">
            <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Neler yapabilirsiniz?</h2>
                <p className="text-slate-400 max-w-2xl mx-auto">Alım-satım ve temettü kayıtlarınızı girin; ortalama maliyet, kâr/zarar ve varlık dağılımını Yarmak hesaplasın.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {featureCards.map((feat) => (
                    <div
                        key={feat.title}
                        className="bg-surface border border-border/80 rounded-2xl p-6 sm:p-8 hover:border-primary/50 transition-colors"
                    >
                        <feat.icon className="w-8 h-8 text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-3">{feat.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
