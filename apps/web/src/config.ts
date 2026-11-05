/** Build-time configuration. Same-origin `/api/v1` by default (nginx / Vite proxy it). */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const STORE_NAME = 'Atelier';
