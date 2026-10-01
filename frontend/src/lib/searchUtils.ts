/**
 * Finansal Varlık Arama ve Benzerlik Yardımcısı (Search & Fuzzy Matching Engine)
 * - Türkçe karakter ve aksan normalizasyonu (İ, ı, ö, ü, ş, ç, ğ)
 * - Akronim / Kısaltma tespiti (Örn: Türk Hava Yolları -> THY)
 * - Alaka puanlama motoru (Relevance Scoring Engine)
 * - Levenshtein mesafesi ile tam yazılmasa bile benzer varlıkları listeleme
 */

/**
 * Türkçe harf, aksan ve noktalama işaretlerini arama için normalize eder
 */
export function normalizeSearchText(text: string): string {
    return (text || '')
        .replace(/İ/g, 'i')
        .replace(/I/g, 'i')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Levenshtein mesafesi (iki kelime arasındaki harf farkı/düzenleme sayısı)
 */
export function levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // değiştirme
                    matrix[i][j - 1] + 1,     // ekleme
                    matrix[i - 1][j] + 1      // silme
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Kelimelerin baş harflerinden kısaltma / akronim üretir (örn: Türk Hava Yolları -> THY)
 */
export function getAcronym(text: string): string {
    const clean = normalizeSearchText(text);
    return clean.split(/\s+/).map(w => w[0]).join('');
}

/**
 * Finansal varlık arama alaka puanlayıcısı
 * Puan > 0 ise varlık arama sonucuyla eşleşmiştir.
 * 
 * Sıralama Hiyerarşisi:
 * - 10000+: Birebir sembol veya tam isim eşleşmesi
 * - 8000+:  Arama terimiyle başlayan semboller (Örn: "ASE" -> "ASELS")
 * - 7000+:  Akronim eşleşmesi (Örn: "thy" -> "Turk Hava Yollari")
 * - 6000+:  İsimdeki kelimelerden biri tam eşleşiyorsa (Örn: "garanti" -> "Garanti Bankasi")
 * - 5000+:  İsim arama terimiyle başlıyorsa
 * - 4000+:  Sembol içinde alt dize veya çoklu kelimelerin tamamı varsa
 * - 2500+:  Çoklu kelimelerin bir kısmı varsa
 * - 500-2000: Benzerlik / Fuzzy eşleşme (Harf hatası olsa bile benzerler aşağıda çıkar)
 */
export function scoreAssetMatch(
    rawSymbol: string,
    rawName: string,
    rawQuery: string
): number {
    const query = normalizeSearchText(rawQuery);
    if (!query) return 0;

    const symbol = normalizeSearchText(rawSymbol);
    const name = normalizeSearchText(rawName);

    // 1. TAM EŞLEŞME (En yüksek öncelik)
    if (symbol === query) return 10000;
    if (name === query) return 9500;

    // 2. SEMBOLLE BAŞLAMA
    // Kısa semboller daha öncelikli (örn: "SA" -> "SAS" > "SASA" > "SAFKR")
    if (symbol.startsWith(query)) {
        return 8800 - Math.min(symbol.length * 20, 500);
    }

    const nameWords = name.split(/\s+/).filter(Boolean);
    const queryWords = query.split(/\s+/).filter(Boolean);
    const acronym = getAcronym(rawName);

    // 3. AKRONİM EŞLEŞMESİ (Örn: "thy" -> "Turk Hava Yollari", "ykb" -> "Yapi Kredi Bankasi")
    if (query.length >= 2 && (acronym === query || acronym.startsWith(query))) {
        return 7800;
    }

    // 4. İSİMDEKİ KELİMELERDEN BİRİ BİREBİR EŞLEŞİYORSA
    if (nameWords.some(w => w === query)) {
        return 7000;
    }

    // 5. İSİM ARAMA TERİMİYLE BAŞLIYORSA (Örn: "turk hava" -> "Turk Hava Yollari")
    if (name.startsWith(query)) {
        return 6500;
    }

    // 6. İSİMDEKİ BİR KELİME ARAMA İLE BAŞLIYORSA (Örn: "sab" -> "Haci Omer Sabanci...")
    if (nameWords.some(w => w.startsWith(query))) {
        return 5800;
    }

    // 7. SEMBOL ARAMAYI İÇERİYORSA (Örn: "th" -> "GRTHO")
    if (symbol.includes(query)) {
        return 5200;
    }

    // 8. ÇOKLU KELİME ARAMASI: TÜM KELİMELER EŞLEŞİYORSA (Örn: "eregli celik" -> "Eregli Demir Celik")
    if (queryWords.length > 1 && queryWords.every(qw => symbol.includes(qw) || nameWords.some(nw => nw.includes(qw)))) {
        return 4800;
    }

    // 9. İSİM İÇİNDE ALT DİZE (SUBSTRING)
    if (query.length >= 2 && name.includes(query)) {
        return 3800;
    }

    // 10. ÇOKLU KELİMEDE HERHANGİ BİR KELİME EŞLEŞİYORSA
    if (queryWords.length > 1) {
        const matchedWordsCount = queryWords.filter(qw => qw.length >= 2 && (symbol.includes(qw) || name.includes(qw))).length;
        if (matchedWordsCount > 0) {
            return 2200 + (matchedWordsCount / queryWords.length) * 1000;
        }
    }

    // 11. BENZERLİK / FUZZY MATCHING (Benzer olanlar aşağıda çıksın)
    if (query.length >= 3) {
        // Sembole Levenshtein yakınlığı (Örn: "aselsn" -> "asels", "tuprs" -> "tuprs")
        const symDist = levenshteinDistance(query, symbol);
        if (symDist === 1) return 1900;
        if (symDist === 2 && query.length >= 5) return 1400;

        // Sembol aramayı prefix veya ters prefix olarak içeriyorsa
        if (query.startsWith(symbol) && symbol.length >= 3) {
            return 1700;
        }

        // İsimdeki kelimelerle harf ve hece benzerliği
        for (const nw of nameWords) {
            if (nw.length >= 3) {
                // Ön ek benzerliği (kelimenin ilk 3-4 harfi tutuyorsa)
                const minLen = Math.min(query.length, nw.length);
                if (minLen >= 3 && query.slice(0, 3) === nw.slice(0, 3)) {
                    return 1500;
                }
                const dist = levenshteinDistance(query, nw);
                if (dist === 1) return 1300;
                if (dist === 2 && query.length >= 5 && nw.length >= 5) return 900;
            }
        }
    }

    return 0;
}
