# UI primitives — v3 "cesur tipografi + terminal detayı" (kısa kılavuz)

Hepsi `@/components/ui/<Ad>` altında default export (aksi yazmıyorsa). Hepsi `className` kabul eder.
Sınıf birleştirmek için `cn()` (`@/lib/cn`): aynı varyantta çakışan sınıflardan **sonra yazılan kazanır**
(görünüm, text rengi, bg rengi, p/px/py/pt/pr/pb/pl, h-*, rounded*, yazı boyutu). Diğer gruplar (m, w, gap, border...) çözülmez:
bir primitive'in `w-*`, `gap-*`, `border-*` sınıfını ezmek için `!` kullanmayın, onun yerine sarmalayıcı kullanın.

v3 = v2'nin veri detayı (mono sayılar, sparkline, yoğun tablolar) + sakin, güçlü bir hiyerarşi. Sahibin v2 yorumu: "her şey her yerde".

## v3.1 okunabilirlik (önce bunu okuyun)
Sahibin yorumu: "okunabilirlik düşük, yaşlı kullanıcıları da düşünün; bazı yerlerde gereksiz ve tekrar eden yazı var".
- **En küçük yazı 13px.** Ölçek globals.css'te büyütüldü, eski sınıflar kendiliğinden büyür:
  `text-11` = `text-xs` = **13px** (etiket, tablo başlığı, ipucu) · `text-13` = `text-sm` = **15px** (gövde, düğme, tablo hücresi, tablo sayısı)
  · `text-base` = **16px** (form alanı, paragraf) · `text-section` 24px · `text-title` 32px · `text-hero` 56px.
  `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[12px]` YASAK. Tablo hücresi `text-sm`, başlık `text-xs`, etiket `text-xs`/`text-13`.
- **Renk:** bilgi taşıyan yazı `text-fg`; `text-fg-muted` yalnızca ikincil (≥ 8.5:1), `text-fg-subtle` yalnızca gerçekten üçüncül ipucu (≥ 6:1).
- **Dokunma hedefi:** mobilde ≥ 44px, masaüstünde ≥ 40px. Primitive'ler bunu kendisi sağlar (Button/IconButton/Input/Select/
  SegmentedControl/Disclosure/CurrencyToggle); sayfada `h-6/h-7/h-8` buton, `size-6/size-8` simge düğmesi yazmayın.
  Kendi tıklanır öğeniz varsa `h-11 sm:h-10` (veya `min-h-11 sm:min-h-10`).
- **Tablo:** satır `h-12` (48px), başlık `h-9 text-xs`, hücre `text-sm`, sayılar `font-mono text-sm text-right`.
- **Paragraf:** `leading-relaxed` veya varsayılan 1.5; uzun metin `text-base`.
- **Tekrar yok:** her şey ekranda bir kez. Başlığı tekrarlayan alt başlık, aynı yere giden ikinci bağlantı, Hero'da ve şeritte aynı toplam,
  ekranda birden fazla "15 dk gecikmeli" notu, iki kez gösterilen sayı, liste zaten tamken "Tümünü gör" YOK. Yasal metinler (yasal uyarı,
  KVKK, SPK, çerez) asla kısaltılmaz/silinmez. Hata/boş durum mesajları ve hata önleyen form ipuçları kalır. Etiketler kısa ve cümle düzeninde.
- **Grafik:** eksen yazısı ≥ 12px (`fontSize: 12`), ipucu ≥ 14px (`fontSize: 14`).

## Sayfa iskeleti (v3)
Her sayfa yukarıdan aşağı, önem sırasıyla:

1. **PageHeader** — display yazı 30/32px kalın başlık, en çok bir kısa alt satır, sağda birincil eylem(ler).
2. **Hero** — sayfanın TEK odak noktası: büyük display sayı (veya sayfanın ana ifadesi) + altında tek mono değişim satırı;
   ana grafik Hero'nun çocuğu olarak hemen altında (`InteractiveAreaChart frameless`).
3. **SummaryStrip** — ikincil rakamların hepsi TEK şeritte (etiket/değer hücreleri, mono, ince çizgi). StatCard ızgarası kurmayın.
4. **Section**'lar — kutusuz bölümler: kalın display başlık + içerik. Listeler/tablolar doğrudan sayfa zemininde, ince çizgilerle.
5. Seyrek gereken bilgi → **Disclosure** ("Detaylar") veya satırın açılan hali.

```tsx
<PageContainer>
  <PageHeader title="Portföyüm" actions={<Button size="sm" leftIcon={<Plus />}>İşlem Ekle</Button>} />
  <div className="flex flex-col gap-6">
    <Hero
      label="Toplam portföy değeri"
      value={fmt(totalVal)}                       // "1.234.567,89 ₺" → ₺ otomatik soluk
      sub={<>
        <HeroMeta label="Toplam getiri"><ChangePill value={pct} amount={fmt(pnl, true)} size="md" /></HeroMeta>
        <HeroMeta label="Bugün"><ChangePill value={dayPct} size="md" /></HeroMeta>
      </>}
      aside={<CurrencyToggle currency={currency} onToggle={toggle} />}
    >
      <InteractiveAreaChart frameless lineTone="primary" height={280} … />
    </Hero>
    <SummaryStrip items={[
      { label: 'Maliyet', value: fmt(cost) },
      { label: 'Gerçekleşen K/Z', value: fmt(realized, true), tone: realized >= 0 ? 'profit' : 'loss' },
      { label: 'Temettü', value: fmt(div) },
      { label: 'Varlık sayısı', value: count },
    ]} />
  </div>

  {/* En çok iki sütun: ana sütun + dar yan sütun (≤ 360px) */}
  <div className="flex flex-col lg:flex-row gap-10">
    <Section title="Varlıklar" action={<Link href="/holdings" className="inline-flex items-center min-h-11 sm:min-h-10 text-sm text-primary">Tümü</Link>} className="lg:basis-0 lg:grow">
      <div className="flex flex-col border-t border-border divide-y divide-border">…satırlar…</div>
    </Section>
    <Section title="Dağılım" size="sm" className="lg:w-[340px] shrink-0">…</Section>
  </div>

  <Disclosure summary="Detaylar">…seyrek gereken rakamlar…</Disclosure>
</PageContainer>
```

## Kesin kurallar (v3)
1. **Tek odak:** sayfa başına bir Hero. Başka hiçbir şey Hero sayısı kadar büyük/kalın olmaz. Hero'yu kutuya koymayın.
2. **Daha az kutu:** bölümleri **Section** ile ayırın (boşluk + kalın başlık), Card ile değil. Çerçeveli panel yalnızca gerçekten ayrı bir
   nesne için: modal, arama açılır listesi, form kutusu. Ekranda aynı anda en çok 1–2 panel. Card içine Card koymayın.
3. **En çok iki sütun:** varsayılan tek ana sütun; masaüstünde ana sütun + dar yan sütun (`lg:w-[320px]`–`lg:w-[360px] shrink-0`).
   Üç sütunlu pano, küçük widget ızgarası YOK. `flex flex-col lg:flex-row gap-10`, ana sütunda `lg:basis-0 lg:grow min-w-0`.
4. **Boşluk hiyerarşiyi verir:** PageContainer bölümler arasına mobilde 32px, masaüstünde 40px koyar (`gap-8 lg:gap-10`).
   Hero ile SummaryStrip birbirine ait olduğu için bir sarmalayıcıda `gap-6` ile durur. Section içi `gap-4`.
5. **İkincil bilgi sıkıştırılır:** destekleyici rakamlar tek SummaryStrip'te; seyrek bilgiler Disclosure'da veya satırın açılan halinde.
6. **Süs yok:** başlık yanına simge/rozet/üst etiket ("eyebrow") koymayın; aynı bilgiyi iki yerde göstermeyin; dekoratif nokta yok.
   Simge yalnızca anlam taşıyorsa (eylem, yön). Bir alanda en çok bir küçük durum rozeti.
7. **Tipografi işi yapar:**
   - `font-display` (Space Grotesk 500/700): sayfa başlığı (PageHeader), Hero sayısı, bölüm başlığı (Section). Başka yerde kullanmayın
     (istisna: Modal başlığı, Navbar/Footer wordmark).
   - `font-sans` (Inter Tight): arayüz yazısı. Gövde `text-sm` (15px), paragraf `text-base` (16px).
   - `font-mono` (IBM Plex Mono): her sayı, fiyat, yüzde, sembol, tarih/saat (tablolar, şeritler, değişimler). Hero sayısı istisna (display).
   - Etiket: `text-xs text-fg-muted` (13px), cümle düzeni (`uppercase`/`tracking-widest` YOK).
   - Ölçek: `text-section` (24px, bölüm), `text-title` (32px, sayfa), `text-hero` (56px, kahraman). `tracking-display` = -0.03em.
     Bunları elle yazmak yerine PageHeader / Section / Hero kullanın.
8. **Tablolar yoğun ama nefesli:** satır `h-12` (48px), başlık `h-9` (36px) `text-xs text-fg-muted sticky top-0 bg-bg`
   (kutusuz tabloda başlık zemini sayfa zemini `bg-bg`; Card içinde `bg-surface`), sütun aralığı `gap-4`/`gap-6`, sayılar `text-right font-mono`,
   sparkline sütunu. Az sütun: "olsa iyi olur" sütunlarını `hidden xl:flex` yapın ya da satırın açılan haline taşıyın.
   Kutusuz liste: `<div className="flex flex-col border-t border-border divide-y divide-border">`.
9. **Değişimler renkli mono yazı:** `<ChangePill value={x} />` → "▲ +%2,40" (% sayının önünde). Tutar ve yüzde birlikteyse önce tutar, yüzde parantezde: `<ChangePill value={pct} amount={fmt(pnl, true)} />` → "▲ +5.000,25 ₺ (+%5,50)". Dolu renkli hap yok; `variant="soft"` yalnızca seçili satır/tek seferlik durum.
10. **Vurgu (primary) az:** etkin menü/sekme alt çizgisi, birincil düğme, portföy grafiği çizgisi, odak, bağlantı. Sayfa başına en çok bir vurgu bloğu
    (ör. ana sayfa CTA alanı) — yalnızca hiyerarşiye yardım ediyorsa.
11. **Şekil:** panel/modal `rounded-md` (6px), kontrol `rounded` (4px); `rounded-xl/2xl/full` YOK (istisna: durum noktası, AssetAvatar). Gölge YOK.
12. **Hareket yok:** yalnızca 120ms renk geçişi (`transition-colors duration-[120ms]`), satır hover (`hover:bg-surface-2`) ve ana sayfa şeridi.
13. Sabit renk yok (`slate-*`, `#hex`, `rgba`). Recharts/SVG: `var(--…)`. Flex önce; grid yalnızca gerçek 2B tablo için (yorumla).
    Sparkline yalnızca gerçek veriyle (`seriesFromPeriodReturns`). 360px mobilde çalışmalı.

## Renk ve yazı sınıfları (globals.css, iki temada da çalışır; renkler v2 ile aynı)
- Zemin: `bg-bg` (sayfa), `bg-surface` (panel/modal), `bg-surface-2` (input, hover satır, segment rayı), `bg-surface-3` (basılı/etkin segment)
- Çizgi: `border-border` (ince ayraç), `border-border-strong` (hover/odaklanmış kap); `divide-y divide-border`
- Yazı: `text-fg`, `text-fg-muted` (ikincil, ≥ 8.5:1), `text-fg-subtle` (üçüncül ipucu, placeholder, ≥ 6:1) — iki temada bg/surface/surface-2 üzerinde
- Marka: `bg-primary text-on-primary hover:bg-primary-hover`, `text-primary`, `bg-primary-soft` (seçili satır)
- Durum: `text-profit`, `text-loss`, `text-warning` (+ `-soft` zeminleri yalnızca rozet/seçili satır). Gecikmeli/eski veri: `text-warning`
- Boyut (v3.1): `text-11` = `text-xs` (13px), `text-13` = `text-sm` (15px), `text-base` (16px), `text-section` (24px), `text-title` (32px), `text-hero` (56px).
  Yazı tipi: `font-sans`, `font-mono`, `font-display`. Harf aralığı: `tracking-display` (-0.03em), `tracking-tight`.
- Odak: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`
- Recharts/SVG/inline: `var(--primary)`, `var(--profit)`, `var(--loss)`, `var(--chart-grid)`, `var(--chart-axis)`, `var(--bg)`, `var(--surface)`,
  `var(--surface-2)`, `var(--border)`, `var(--border-strong)`, `var(--fg)`, `var(--fg-muted)`, `var(--fg-subtle)`, `var(--font-mono)`, `var(--font-display)`.
  Tooltip: `{background:'var(--surface)', border:'1px solid var(--border-strong)', borderRadius:4, fontFamily:'var(--font-mono)', fontSize:14, boxShadow:'none'}`.
  Eksen yazısı: `tick={{ fill:'var(--chart-axis)', fontFamily:'var(--font-mono)', fontSize:12 }}`, ızgara düz çizgi `stroke="var(--chart-grid)"` (kesikli değil).
  Kutusuz grafikte nokta kenarı `var(--bg)` (panel içinde `var(--surface)`).
- Koyu temada `text-on-primary` koyu renktir; primary zemin üzerine `text-white` yazmayın.
- Eski adlar geçici olarak çalışır (`bg-surface-hover`, `bg-primary-light`, `text-foreground`, `shadow-card` artık gölgesiz); yenilerine geçin.
- `@/lib/formatters` → `splitCurrencySymbol("1.234,56 ₺")` = `{sign, number, symbol, symbolFirst}` (Hero bunu kendisi kullanır).

## Yeni bileşenler (v3)
- **Hero** `{label?, value, currencySuffix?, sub?, aside?, size?: 'lg'|'md', valueClassName?, children?}` (+ named **HeroMeta** `{label, children}`).
  `value` display yazı, kalın, `tracking-display`, tabular: `lg` 38/48/56px (mobil/sm/lg), `md` 32/40px (ikincil sayfalar: alarmlar, piyasalar).
  `value` metinse para simgesi (`₺`, `$`, `€`; başta veya sonda) kendiliğinden küçük ve `text-fg-subtle` yazılır; elle vermek için `currencySuffix`.
  `sub`: değerin altında tek mono satır (`gap-x-5`), parçaları `<HeroMeta label="Bugün"><ChangePill … /></HeroMeta>`.
  `aside`: sağda (mobilde altta) küçük kontroller — para birimi seçici, "Alarm kur" gibi tek düğme. `children`: tam genişlik ana grafik.
  Kutu, kenarlık, zemin yok. Sayfada yalnızca bir tane.
- **Section** `{title, description?, action?, size?: 'md'|'sm', id?, contentClassName?, children}` kutusuz bölüm.
  Başlık `font-display` kalın 22/24px (`sm`: 20px, dar yan sütun için), sağda `action` (SegmentedControl `size="sm"`, "Tümü" bağlantısı, `size="sm"` Button).
  İçerik `flex flex-col`; araya boşluk gerekiyorsa `contentClassName="gap-3"`. `id` verilirse çapa + `aria-labelledby` olur.
  **Sayfalarda Card yerine bunu tercih edin.** `<Section title="İşlem geçmişi" action={<TxFilterBar …/>}>…liste…</Section>`
- **SummaryStrip** `{items: {label, value, hint?, tone?: 'default'|'muted'|'profit'|'loss'|'warning'|'primary', title?}[], ariaLabel?}`.
  Üstte ve altta ince çizgi, hücreler arasında dikey ince çizgi, kutu yok; ilk hücre sayfa kenarıyla hizalı. Değer `font-mono text-base font-medium` (16px),
  etiket `text-13 text-fg-muted` (15px), `hint` 13px. Mobilde ikişerli; sm'de ≤ 4 hücre tek satır (fazlası üçerli); lg'de hepsi tek satır.
  En çok ~6 hücre. Değer olarak `<ChangePill>` da verilebilir. Sayfada bir tane (Hero'nun hemen altında).
- **Disclosure** `{summary, defaultOpen?, contentClassName?, children}` yerel `<details>`: "› Detaylar" satırı (15px, fg-muted, 44/40px yüksek), açılınca altında içerik (`gap-3 pt-3`).
  `<Disclosure summary="Detaylar"><SummaryStrip items={…} /></Disclosure>`

## Değişen bileşenler (v3)
- **PageHeader** `{title, subtitle?, actions?}` (API aynı): h1 `font-display` kalın 30/32px `tracking-display`; alt satır `text-base text-fg-muted`.
- **PageContainer** `{width?: 'narrow'(3xl)|'default'(1280px)|'wide'(1280px)}` `px-4 sm:px-6`, üst 24/32px, alt 40/56px, `gap-8 lg:gap-10`.
  Navbar ve Footer da 1280px; sayfa kenarı üst çubukla hizalı. Alt menü boşluğunu Footer bırakır.
- **Card** (API aynı) daha sakin: CardHeader'ın alt çizgisi yok, başlık `text-sm font-semibold`. Yalnızca ayrı nesneler için (bkz. kural 2).
- **SegmentedControl** `variant="underline"`: sekmeler arası 24px, `md` 48/44px yüksek 16px, `sm` 44/40px 15px.
- **Modal** başlığı `font-display` 18px kalın, gövde 15px. **StatCard** duruyor ama yeni yerde kullanmayın → SummaryStrip.
- **InteractiveAreaChart** (`@/components/InteractiveAreaChart`, named): eski proplar + `frameless?: boolean`. `frameless` iken panel çerçevesi
  ve başlık çubuğu yok, yatay iç boşluk yok; üst satırda dönem getirisi/dip/zirve solda, dönem seçici sağda; tarih aralığı satırı çizgisiz.
  Başlığı çevreleyen Section/Hero verir (`title` yine ipucu etiketi). Hero'nun çocuğu veya Section içeriği olarak kullanın:
  `<Section title="Fiyat geçmişi"><InteractiveAreaChart frameless … /></Section>`. Çerçeveli mod (varsayılan) eskisi gibi.
  `signed` (K/Z gibi eksiye inebilen seri): ipucu ve uç değerler "+/−" ile, sıfır çizgisi çizilir; `minLabel`/`maxLabel` "Dip"/"Zirve" yerine
  (ana sayfa: `dataKey="pnl"`, "En düşük K/Z"/"En yüksek K/Z", `lineTone="auto"` → çizgi K/Z satırıyla aynı renkte).

## Bileşenler (v2'den, değişmedi)
- **Button** `{variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'(mobil 44 / masaüstü 40px, 15px)|'md'(44px, 15px), fullWidth?, leftIcon?, rightIcon?, loading?}` + `<button>` propları.
  Simge boyutu otomatik (`[&_svg]`), simgelere `size-*` vermeyin. `buttonClasses({variant, size, fullWidth, className})` Link'e aynı görünümü verir.
  Sayfa başına bir birincil (primary) düğme; diğerleri secondary/ghost.
- **IconButton** `{icon, label, variant?: 'ghost'|'secondary'|'primary', size?: 'sm'(44/40px)|'md'(44px), active?}`.
  Yalnızca simgeli düğmede `label` hem aria-label hem ipucudur; masaüstünde yer varsa simge yerine yazılı `Button` tercih edin ("Sil", "Düzenle").
- **CardHeader** (named) `{title, subtitle?, icon?, action?}`. Card'ın **doğrudan ilk çocuğu** olduğunda iç boşluklu panelde de kenardan kenara uzanır.
- **Input** `{invalid?, leftIcon?, rightSlot?, containerClassName?}` 44/40px, yazı 16px; `type="number"` veya `inputMode="decimal|numeric"` ise otomatik mono.
- **Select** `{invalid?, containerClassName?}` 44/40px, 16px. **Textarea** `{invalid?}`.
- **Field** `{label?, htmlFor?, hint?, error?, labelAction?, required?}` (etiket 15px `text-fg`, ipucu 13px `text-fg-muted`, hata 15px).
- **SegmentedControl** `<T>{options, value, onChange, size?: 'sm'|'md', variant?: 'segment'|'underline', mono?, fullWidth?, ariaLabel?}`.
  `segment` (varsayılan): dönem, para birimi, görünüm seçimi. `underline`: sayfa düzeyi sekmeler (mavi alt çizgi). Dönem kısaltmalarında `mono`.
- **Badge** `{tone?: 'neutral'|'primary'|'profit'|'loss'|'warning', icon?, title?}` 24px, 4px köşe, 13px. Varsayılan nötr; alan başına en çok bir tane.
- **ChangePill** `{value, decimals? = 2, size?: 'sm'(15px)|'md'(16px), showIcon? = true, variant?: 'text'|'soft', amount?, children?, title?}`.
  Varsayılan `text`: zeminsiz renkli mono "▲ +%2,40" / "▼ −%0,12"; sıfır gri ve işaretsiz ("%0,00"). Ok sabit genişlikte (sıfırda boş yer tutar), alt alta değerler hizalı kalır. `amount` verilirse "tutar (yüzde)" yazar. `children` verilirse onu yazar (renk `value` işaretinden).
- **Sparkline** `{values: number[], width? = 64, height? = 20, strokeWidth?, color?: 'auto'|'primary'|'profit'|'loss'|'muted', ariaLabel?}`.
  Yalnızca gerçek veri; 3'ten az nokta varsa hiçbir şey çizmez. Named `seriesFromPeriodReturns(current, [r1Y, r6A, r3A, r1A, r1H, r1G])`.
  `<Sparkline values={seriesFromPeriodReturns(price, [h.r1y, h.r6m, h.r3m, h.r1m, h.r1w, h.r1d])} />`
- **Modal** (client) `{open, onClose, title, description?, icon?, iconTone?, size?: 'sm'|'md'|'lg'|'xl', footer?, dismissible? = true}`.
  Mobilde alttan açılır. Footer formun dışında: `<Button type="submit" form="tx-form">`.
- **EmptyState** `{icon, title, description?, action?}` küçük gri simge + kısa metin. Kutusuz bölümde doğrudan Section içine koyun.
- **Skeleton** `{className}` 4px köşe: `<Skeleton className="h-4 w-24" />`. Hero iskeleti: `<Skeleton className="h-12 w-64" />`.
- **AssetAvatar** `{symbol, size?: 'sm'(32px)|'md'(36px)|'lg'(44px)}` mono baş harfler (13px).
- **CurrencyToggle** `{currency, onToggle, disabled?, className?}` segment görünümünde (Hero `aside` için). **LoadingSpinner** `{message?, withLogo?, fullScreen?}`.
- **ThemeToggle**, **BottomNav**: Navbar içinde; sayfalarda gerekmez. `useTheme()` → `{theme, setTheme, toggleTheme}` (`./ThemeProvider`, named).

## Kalıplar
- Kutusuz tablo satırı (flex): `<div className="flex items-center h-12 gap-4 hover:bg-surface-2">` → sol `flex-1 min-w-0`
  (sembol `font-mono text-sm font-medium` + ad `text-xs text-fg-muted truncate`), sağda `w-28 text-right font-mono text-sm` sütunlar.
  Başlık satırı aynı genişliklerle `h-9 text-xs text-fg-muted border-b border-border`. Kutusuz listede hover zemini kenara taşsın istiyorsanız
  satıra `-mx-2 px-2 rounded` verin (hizayı bozmadan).
- Mobilde (≤ sm) tablolar iki satırlı yığın satıra döner: üstte sembol + değer, altta ad + ChangePill.
- Etiket/değer çifti (Disclosure veya yan sütun içinde): `<div className="flex justify-between text-sm"><span className="text-fg-muted">Maliyet</span><span className="font-mono text-fg">…</span></div>`.
- Sekmeli sayfa: PageHeader → `SegmentedControl variant="underline"` → sekmenin Hero/Strip/Section'ları.
