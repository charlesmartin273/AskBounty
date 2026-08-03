/**
 * Shared film-grain tile (design-system.md §5.8) - inline SVG fractal
 * noise as a data URI, no image asset needed. Tiles at 120px.
 * Used by the marketing layout (page-wide overlay) and hero backdrop.
 */
export const GRAIN_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
