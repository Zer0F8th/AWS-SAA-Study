const configuredBase = import.meta.env.BASE_URL;
const base = configuredBase === '/' ? '' : configuredBase.replace(/\/$/, '');

/** Prefix a root-relative URL with Astro's configured deployment base. */
export function withBase(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}` || '/';
}
