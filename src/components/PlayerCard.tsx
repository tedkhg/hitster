import type { Player, Song } from "../lib/types";

export default function PlayerCard({
  player,
  songsById,
  onRename,
}: {
  player: Player;
  songsById: Record<string, Song>;
  onRename?: (name: string) => void;
}) {
  const items = [...player.timeline].sort((a, b) => a.year - b.year);
  return (
    <div className="tile">
      <div className="row" style={{ justifyContent: "space-between" }}>
        {onRename ? (
          <input
            className="input"
            value={player.name}
            onChange={(e) => onRename(e.target.value)}
            style={{ maxWidth: 140, fontWeight: 800 }}
            aria-label="이름 변경"
          />
        ) : (
          <div style={{ fontWeight: 800 }}>{player.name}</div>
        )}
        <span className="badge">점수 {player.score}</span>
      </div>
      <div className="hr" />
      {items.length === 0 ? (
        <div className="small">아직 카드가 없어요.</div>
      ) : (
        <div className="timeline">
          {items.map((c) => {
            const s = songsById[c.songId];
            const label = s ? `${c.year} · ${s.artist} - ${s.title}` : `${c.year}`;
            return (
              <span key={c.songId} className="pill" title={label}>
                <span className="mono">{c.year}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
