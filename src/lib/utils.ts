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

export function extractVideoIdFromQuery(query: string): string {
  // YouTube 검색 쿼리에서 비디오 ID를 추출하는 간단한 방법
  // 실제로는 YouTube Data API를 사용해야 하지만, 여기서는 직접 비디오 ID를 사용
  // youtubeQuery 형식을 "비디오ID" 또는 검색 쿼리로 지원
  const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (videoIdPattern.test(query)) {
    return query;
  }
  // 검색 쿼리인 경우 null 반환 (나중에 처리)
  return "";
}
