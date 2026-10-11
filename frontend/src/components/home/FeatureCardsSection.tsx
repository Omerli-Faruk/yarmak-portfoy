import { featureCards } from '@/data/homeData';
import Section from '@/components/ui/Section';

// Özellikler: kalın bölüm başlığı, altında ince çizgilerle ayrılmış sakin başlık / açıklama listesi
export default function FeatureCardsSection() {
    return (
        <Section
            id="ozellikler"
            title="Neler yapabilirsiniz?"
            className="scroll-mt-16"
        >
            <dl className="flex flex-col divide-y divide-border border-y border-border">
                {featureCards.map((feat) => (
                    <div key={feat.title} className="flex flex-col gap-1 py-4 md:flex-row md:gap-10">
                        <dt className="text-base font-semibold text-fg md:w-72 md:shrink-0">{feat.title}</dt>
                        <dd className="max-w-[72ch] text-base leading-relaxed text-fg-muted">{feat.desc}</dd>
                    </div>
                ))}
            </dl>
        </Section>
    );
}
