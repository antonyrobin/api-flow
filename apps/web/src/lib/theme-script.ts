/**
 * Theme constants shared by the server layout (inline script) and the client ThemeProvider.
 * Kept out of the "use client" module so the server can import plain values.
 */
export const THEMES = ["system", "dark", "light", "ocean"] as const;
export type ThemePreference = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const THEME_STORAGE_KEY = "apiflow-theme";

/**
 * Inline script for <head>: applies the saved theme before first paint
 * so there's no flash of the wrong theme. Must stay self-contained.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var t=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;if(["dark","light","ocean"].indexOf(t)<0)t="dark";var d=document.documentElement;d.dataset.theme=t;d.classList.toggle("dark",t!=="light");}catch(e){}})();`;

