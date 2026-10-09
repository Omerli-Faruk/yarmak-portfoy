// Varlık araması için yardımcılar: Türkçe karakterleri sadeleştirme, baş harf kısaltması
// (Türk Hava Yolları -> thy), alaka puanı ve küçük yazım hatalarını yakalamak için Levenshtein mesafesi.

// Karşılaştırma için metni küçük harfe, Türkçe karakterleri ASCII karşılığına çevirir ve noktalamayı atar.
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

// İki metin arasındaki düzenleme (ekleme, silme, değiştirme) sayısı
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

// Kelimelerin baş harflerinden kısaltma üretir: "Türk Hava Yolları" -> "thy"
export function getAcronym(text: string): string {
    const clean = normalizeSearchText(text);
    return clean.split(/\s+/).map(w => w[0]).join('');
}

/**
 * Aramanın bir varlıkla ne kadar eşleştiğini puanlar; 0 eşleşme yok demektir.
 * Sıra: tam sembol/isim (9500-10000), sembolün başı (8300-8800), kısaltma (7800),
 * isimdeki bir kelime (7000), ismin başı (6500), kelime başı (5800), sembol içinde (5200),
 * aranan kelimelerin hepsi (4800), isim içinde (3800), kelimelerin bir kısmı (2200-3200),
 * yazım hatası toleransı (900-1900).
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

    // Tam eşleşme
    if (symbol === query) return 10000;
    if (name === query) return 9500;

    // Sembol aramayla başlıyorsa kısa semboller öne çıkar ("SA" -> "SAS" > "SASA" > "SAFKR")
    if (symbol.startsWith(query)) {
        return 8800 - Math.min(symbol.length * 20, 500);
    }

    const nameWords = name.split(/\s+/).filter(Boolean);
    const queryWords = query.split(/\s+/).filter(Boolean);
    const acronym = getAcronym(rawName);

    // Kısaltma eşleşmesi ("thy" -> "Turk Hava Yollari", "ykb" -> "Yapi Kredi Bankasi")
    if (query.length >= 2 && (acronym === query || acronym.startsWith(query))) {
        return 7800;
    }

    // İsimdeki kelimelerden biri aramayla aynıysa
    if (nameWords.some(w => w === query)) {
        return 7000;
    }

    // İsim aramayla başlıyorsa ("turk hava" -> "Turk Hava Yollari")
    if (name.startsWith(query)) {
        return 6500;
    }

    // İsimdeki bir kelime aramayla başlıyorsa ("sab" -> "Haci Omer Sabanci...")
    if (nameWords.some(w => w.startsWith(query))) {
        return 5800;
    }

    // Sembol aramayı içeriyorsa ("th" -> "GRTHO")
    if (symbol.includes(query)) {
        return 5200;
    }

    // Çok kelimeli aramada bütün kelimeler bulunuyorsa ("eregli celik" -> "Eregli Demir Celik")
    if (queryWords.length > 1 && queryWords.every(qw => symbol.includes(qw) || nameWords.some(nw => nw.includes(qw)))) {
        return 4800;
    }

    // İsim aramayı içeriyorsa
    if (query.length >= 2 && name.includes(query)) {
        return 3800;
    }

    // Çok kelimeli aramada kelimelerin bir kısmı bulunuyorsa
    if (queryWords.length > 1) {
        const matchedWordsCount = queryWords.filter(qw => qw.length >= 2 && (symbol.includes(qw) || name.includes(qw))).length;
        if (matchedWordsCount > 0) {
            return 2200 + (matchedWordsCount / queryWords.length) * 1000;
        }
    }

    // Yazım hatası toleransı; bu eşleşmeler listenin altında kalır
    if (query.length >= 3) {
        // Sembole 1-2 harf uzaklık ("aselsn" -> "asels")
        const symDist = levenshteinDistance(query, symbol);
        if (symDist === 1) return 1900;
        if (symDist === 2 && query.length >= 5) return 1400;

        // Arama sembolle başlıyorsa ("aselsan" -> "asels")
        if (query.startsWith(symbol) && symbol.length >= 3) {
            return 1700;
        }

        // İsimdeki kelimelere benzerlik
        for (const nw of nameWords) {
            if (nw.length >= 3) {
                // İlk 3 harf tutuyorsa
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
