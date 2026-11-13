/** Doctor names are often stored with the title already ("Dr. Rao"); don't print it twice. */
export const drName = (name?: string | null) => (!name ? '' : /^dr\b/i.test(name.trim()) ? name.trim() : `Dr. ${name.trim()}`);
