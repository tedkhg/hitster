export function uuid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ytSearchUrl(query: string) {
  const q = encodeURIComponent(query);
  return `https://www.youtube.com/results?search_query=${q}`;
}
