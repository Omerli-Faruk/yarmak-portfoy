// Koşullu sınıf adlarını birleştirir: cn('a', ok && 'b', undefined) -> "a b"
//
// Ek olarak, aynı varyanttaki (hover:, sm: vb.) çakışan sınıflardan SONRA yazılan kazanır.
// Böylece bileşene verilen className, bileşenin kendi sınıfını ezebilir: cn('h-9 px-3', 'h-8') -> "px-3 h-8".
// Bilinçli olarak küçük tutuldu; yalnızca şu gruplar çözülür:
//   görünüm (block, flex, hidden...), yazı rengi (text-<tema rengi>), zemin rengi (bg-<tema rengi>),
//   iç boşluk (p, px, py, pt, pr, pb, pl, ps, pe), yükseklik (h-*), köşe (rounded*),
//   yazı boyutu (text-xs..9xl, text-11, text-13, text-section, text-title, text-hero, text-[15px]).
// Bunların dışındaki sınıflar (m-*, w-*, gap-*, border-* ...) olduğu gibi birlikte kalır.

type ClassValue = string | false | null | undefined | 0;

const DISPLAY = new Set([
    'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid',
    'hidden', 'contents', 'flow-root', 'list-item', 'table', 'table-row', 'table-cell',
]);

// globals.css'teki tema renkleri ve birkaç genel renk; "/80" gibi saydamlık eki de kabul edilir
const COLORS = new Set([
    'bg', 'surface', 'surface-2', 'surface-3', 'border', 'border-strong',
    'fg', 'fg-muted', 'fg-subtle',
    'primary', 'primary-hover', 'primary-soft', 'on-primary',
    'profit', 'profit-soft', 'loss', 'loss-soft', 'warning', 'warning-soft',
    'chart-grid', 'chart-axis',
    'surface-hover', 'primary-light', 'foreground', 'background',
    'transparent', 'current', 'inherit', 'white', 'black',
]);

const FONT_SIZES = new Set([
    'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl', '11', '13',
    'section', 'title', 'hero',
]);

// Bir grup yazıldığında daha önce yazılmış bu alt grupları da geçersiz kılar (p-4, önceki px-2'yi siler)
const OVERRIDES: Record<string, string[]> = {
    p: ['px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'],
    px: ['pr', 'pl', 'ps', 'pe'],
    py: ['pt', 'pb'],
    rounded: ['rounded-t', 'rounded-r', 'rounded-b', 'rounded-l', 'rounded-s', 'rounded-e',
        'rounded-tl', 'rounded-tr', 'rounded-br', 'rounded-bl', 'rounded-ss', 'rounded-se', 'rounded-es', 'rounded-ee'],
    'rounded-t': ['rounded-tl', 'rounded-tr'],
    'rounded-r': ['rounded-tr', 'rounded-br'],
    'rounded-b': ['rounded-br', 'rounded-bl'],
    'rounded-l': ['rounded-tl', 'rounded-bl'],
    'rounded-s': ['rounded-ss', 'rounded-es'],
    'rounded-e': ['rounded-se', 'rounded-ee'],
};

const PADDING_RE = /^(p|px|py|pt|pr|pb|pl|ps|pe)-.+$/;
// "rounded", "rounded-md", "rounded-t", "rounded-t-md"; "rounded-sm" köşe değil boyuttur (s'den sonra "-" yok)
const ROUNDED_RE = /^rounded(?:-(t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee)(?=-|$))?(?:-.+)?$/;

function isColor(value: string): boolean {
    return COLORS.has(value.split('/')[0]) || /^\[(#|rgb|hsl|color:)/.test(value);
}

// "sm", "sm/6", "[13px]"
function isFontSize(value: string): boolean {
    return FONT_SIZES.has(value.split('/')[0]) || /^\[(\d|\.\d|length:)/.test(value);
}

// Varyantsız, ! işaretsiz sınıfın grubunu döner; tanınmıyorsa null
function groupOf(base: string): string | null {
    if (DISPLAY.has(base)) return 'display';
    if (base.startsWith('h-')) return 'h';
    if (base.startsWith('text-')) {
        const value = base.slice(5);
        if (isFontSize(value)) return 'font-size';
        if (isColor(value)) return 'text-color';
        return null; // text-center, text-nowrap vb.
    }
    if (base.startsWith('bg-')) return isColor(base.slice(3)) ? 'bg-color' : null;
    const padding = PADDING_RE.exec(base);
    if (padding) return padding[1];
    const rounded = ROUNDED_RE.exec(base);
    if (rounded) return rounded[1] ? `rounded-${rounded[1]}` : 'rounded';
    return null;
}

// "sm:hover:bg-surface-2" -> ["sm:hover:", "bg-surface-2"]; köşeli parantez içindeki ":" bölmez ([&_svg]:size-4)
function splitVariant(token: string): [string, string] {
    let depth = 0;
    let last = -1;
    for (let i = 0; i < token.length; i++) {
        const ch = token[i];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === ':' && depth === 0) last = i;
    }
    return [token.slice(0, last + 1), token.slice(last + 1)];
}

function conflictInfo(token: string): { prefix: string; group: string } | null {
    const [variant, rawBase] = splitVariant(token);
    let base = rawBase;
    let important = '';
    if (base.startsWith('!')) { base = base.slice(1); important = '!'; }
    else if (base.endsWith('!')) { base = base.slice(0, -1); important = '!'; }
    const group = groupOf(base);
    return group ? { prefix: variant + important, group } : null;
}

export function cn(...classes: ClassValue[]): string {
    const tokens = classes.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const kept: string[] = [];

    // Sondan başa gezilir: bir grubu ilk gören (yani en son yazılan) sınıf kalır
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const info = conflictInfo(token);
        if (info) {
            const key = info.prefix + info.group;
            if (seen.has(key)) continue;
            seen.add(key);
            for (const sub of OVERRIDES[info.group] ?? []) seen.add(info.prefix + sub);
        }
        kept.push(token);
    }

    return kept.reverse().join(' ');
}
