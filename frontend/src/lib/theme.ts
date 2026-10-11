// Tema ayarları. Bu dosya hem sunucu (layout) hem istemci (ThemeProvider) tarafından kullanılır.

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'yarmak-theme';

// Tarayıcı çubuğu rengi; globals.css içindeki --bg ile aynı
export const THEME_BG: Record<Theme, string> = {
    dark: '#090B0F',
    light: '#F3F4F6',
};

// Sayfa boyanmadan önce <head> içinde çalışır: kayıtlı seçim, yoksa sistem tercihi, o da yoksa koyu tema.
export const THEME_INIT_SCRIPT = `(function(){var t;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(t!=='dark'&&t!=='light'){try{t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}catch(e){t='dark'}}document.documentElement.setAttribute('data-theme',t)})();`;
