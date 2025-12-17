import React, { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import songs from "./data/songs.kr.2000_now.json";
import type { ChallengeRule, GameState, Player, RoundRule, Song, TimelineCard } from "./lib/types";
import { clearState, loadState, saveState } from "./lib/storage";
import { shuffle, uuid, ytSearchUrl } from "./lib/utils";
import PlayerCard from "./components/PlayerCard";
import DraggableSongCard from "./components/DraggableSongCard";
import { DropSlot } from "./components/TimelineDrop";

const SONGS = songs as Song[];
const songsById: Record<string, Song> = Object.fromEntries(SONGS.map((s) => [s.id, s]));

function freshState(): GameState {
  return {
    mode: "players",
    players: [],
    deckSongIds: shuffle(SONGS.map((s) => s.id)),
    usedSongIds: [],
    currentSongId: null,
    revealed: false,
    roundRule: "single",
    activeTeamId: null,
    roundPlacedTeamIds: [],
    challengeRule: "noPenalty",
  };
}

function freshTeamsState(): GameState {
  const t1 = uuid();
  const t2 = uuid();
  const t3 = uuid();
  return {
    mode: "teams",
    players: [
      { id: t1, name: "1팀", score: 0, timeline: [] },
      { id: t2, name: "2팀", score: 0, timeline: [] },
      { id: t3, name: "3팀", score: 0, timeline: [] },
    ],
    deckSongIds: shuffle(SONGS.map((s) => s.id)),
    usedSongIds: [],
    currentSongId: null,
    revealed: false,
    roundRule: "single",
    activeTeamId: t1,
    roundPlacedTeamIds: [],
    challengeRule: "noPenalty",
  };
}

function isPlacementCorrect(timeline: TimelineCard[], insertIndex: number, actualYear: number): boolean {
  const sorted = [...timeline].sort((a, b) => a.year - b.year);
  const left = sorted[insertIndex - 1]?.year;
  const right = sorted[insertIndex]?.year;
  if (left !== undefined && actualYear < left) return false;
  if (right !== undefined && actualYear > right) return false;
  // allow equal years (rare) — keep stable
  return true;
}

export default function App() {
  const [state, setState] = useState<GameState>(() => {
    const loaded = loadState();
    // backward compat
    if (!loaded) return freshState();
    const mode = (loaded as any).mode ?? "players";
    const roundRule: RoundRule = (loaded as any).roundRule ?? "single";
    const challengeRule: ChallengeRule = (loaded as any).challengeRule ?? "noPenalty";
    const roundPlacedTeamIds: string[] = (loaded as any).roundPlacedTeamIds ?? [];
    let activeTeamId: string | null = (loaded as any).activeTeamId ?? null;
    // ensure activeTeamId is valid in teams mode
    if (mode === "teams") {
      const players = (loaded as any).players ?? [];
      if (!activeTeamId && players[0]?.id) activeTeamId = players[0].id;
    }
    return { ...(loaded as any), mode, roundRule, challengeRule, roundPlacedTeamIds, activeTeamId } as GameState;
  });
  const [newName, setNewName] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "normal" | "hard">("all");
  const [challengeBy, setChallengeBy] = useState<string>("");

  const filteredDeck = useMemo(() => {
    if (difficulty === "all") return state.deckSongIds;
    const allowed = new Set(SONGS.filter((s) => s.difficulty === difficulty).map((s) => s.id));
    return state.deckSongIds.filter((id: string) => allowed.has(id));
  }, [state.deckSongIds, difficulty]);

  const currentSong = state.currentSongId ? songsById[state.currentSongId] : null;

  useEffect(() => {
    if (state.mode !== "teams") return;
    const lr = state.lastResult;
    if (!lr || lr.challengeResolved) return;
    if (challengeBy) return;
    const other = state.players.find((p) => p.id !== lr.playerId);
    if (other) setChallengeBy(other.id);
  }, [state.mode, state.lastResult, state.players, challengeBy]);

  const canDropFor = (playerId: string) => {
    if (!currentSong || state.revealed) return false;
    if (state.mode !== "teams") return true;
    const rr: RoundRule = state.roundRule ?? "single";
    if (rr === "single") {
      return playerId === (state.activeTeamId ?? state.players[0]?.id);
    }
    const placed = new Set(state.roundPlacedTeamIds ?? []);
    return !placed.has(playerId);
  };

  const roundRule: RoundRule = state.roundRule ?? "single";
  const challengeRule: ChallengeRule = state.challengeRule ?? "noPenalty";
  const activeTeamId = state.activeTeamId ?? (state.mode === "teams" ? state.players[0]?.id ?? null : null);
  const roundPlacedTeamIds = new Set(state.roundPlacedTeamIds ?? []);

  function commit(next: GameState) {
    setState(next);
    saveState(next);
  }

  function normalizeTeamsConfig(next: GameState): GameState {
    if (next.mode !== "teams") return next;
    const first = next.players[0]?.id ?? null;
    return {
      ...next,
      roundRule: next.roundRule ?? "single",
      activeTeamId: next.activeTeamId ?? first,
      roundPlacedTeamIds: next.roundPlacedTeamIds ?? [],
      challengeRule: next.challengeRule ?? "noPenalty",
    };
  }

  function addPlayer() {
    const name = newName.trim();
    if (!name) return;
    if (state.mode === "teams") return; // 팀전은 기본 3팀 고정 (이름만 수정)
    const p: Player = { id: uuid(), name, score: 0, timeline: [] };
    commit({ ...state, players: [...state.players, p] });
    setNewName("");
  }

  function resetAll() {
    clearState();
    commit(normalizeTeamsConfig(state.mode === "teams" ? freshTeamsState() : freshState()));
  }

  function startTeamsMode() {
    clearState();
    commit(normalizeTeamsConfig(freshTeamsState()));
  }

  function startPlayersMode() {
    clearState();
    commit(normalizeTeamsConfig(freshState()));
  }

  function drawSong() {
    if (filteredDeck.length === 0) return;
    const [id, ...rest] = filteredDeck;
    // remove drawn from deckSongIds (not only filtered)
    const deckSet = new Set(state.deckSongIds);
    deckSet.delete(id);
    const deckSongIds = [...deckSet];
    commit({
      ...state,
      deckSongIds,
      usedSongIds: [...state.usedSongIds, id],
      currentSongId: id,
      revealed: false,
      lastResult: undefined,
      // per-round
      roundPlacedTeamIds: [],
    });
    setChallengeBy("");
  }

  function reveal() {
    if (!state.currentSongId) return;
    commit({ ...state, revealed: true });
  }

  function openYouTube() {
    if (!currentSong) return;
    window.open(ytSearchUrl(currentSong.youtubeQuery), "_blank", "noopener,noreferrer");
  }

  function placeForPlayer(playerId: string, insertIndex: number) {
    if (!currentSong) return;
    if (!canDropFor(playerId)) return;
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    const actualYear = currentSong.year;
    const sorted = [...player.timeline].sort((a, b) => a.year - b.year);
    const ok = isPlacementCorrect(sorted, insertIndex, actualYear);

    if (ok) {
      const nextTimeline = [...sorted];
      nextTimeline.splice(insertIndex, 0, { songId: currentSong.id, year: actualYear });
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, timeline: nextTimeline, score: p.score + 1 } : p
      );
      commit({
        ...state,
        players,
        revealed: true,
        lastResult: {
          playerId,
          ok: true,
          songId: currentSong.id,
          placedYear: actualYear,
          actualYear,
          insertedIndex: insertIndex,
        },
        roundPlacedTeamIds:
          state.mode === "teams" && roundRule === "all"
            ? Array.from(new Set([...(state.roundPlacedTeamIds ?? []), playerId]))
            : state.roundPlacedTeamIds,
      });
    } else {
      // 실패: 점수 -1 (0 밑으로는 안 내려감), 카드는 버림(used 유지)
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, score: Math.max(0, p.score - 1) } : p
      );
      commit({
        ...state,
        players,
        revealed: true,
        lastResult: {
          playerId,
          ok: false,
          songId: currentSong.id,
          placedYear: actualYear,
          actualYear,
          insertedIndex: insertIndex,
        },
        roundPlacedTeamIds:
          state.mode === "teams" && roundRule === "all"
            ? Array.from(new Set([...(state.roundPlacedTeamIds ?? []), playerId]))
            : state.roundPlacedTeamIds,
      });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    if (active.id !== "current-song") return;
    const id = String(over.id);
    if (!id.startsWith("drop:")) return;
    const [, playerId, idxStr] = id.split(":");
    const insertIndex = Number(idxStr);
    if (!playerId || Number.isNaN(insertIndex)) return;
    placeForPlayer(playerId, insertIndex);
  }

  function findInsertIndexForYear(timeline: TimelineCard[], year: number): number {
    const sorted = [...timeline].sort((a, b) => a.year - b.year);
    let i = 0;
    while (i < sorted.length && sorted[i].year <= year) i++;
    return i;
  }

  function resolveChallenge(applied: boolean) {
    if (state.mode !== "teams") return;
    const lr = state.lastResult;
    if (!lr || lr.challengeResolved) return;

    if (!applied) {
      commit({
        ...state,
        lastResult: { ...lr, challengeResolved: true, challengedById: undefined, challengeSucceeded: false },
      });
      return;
    }

    // choose challenger (must be other team)
    const challengerId = challengeBy || state.players.find((p) => p.id !== lr.playerId)?.id;
    if (!challengerId || challengerId === lr.playerId) {
      commit({ ...state, lastResult: { ...lr, challengeResolved: true, challengeSucceeded: false } });
      return;
    }

    // In Hitster-style objection: if the original placement was wrong and challenged, challenger wins the card.
    const succeeded = lr.ok === false;

    let players = [...state.players];

    if (succeeded) {
      players = players.map((p) => {
        if (p.id !== challengerId) return p;
        const idx = findInsertIndexForYear(p.timeline, lr.actualYear);
        const sorted = [...p.timeline].sort((a, b) => a.year - b.year);
        const nextTimeline = [...sorted];
        nextTimeline.splice(idx, 0, { songId: lr.songId, year: lr.actualYear });
        return { ...p, timeline: nextTimeline, score: p.score + 1 };
      });
    } else if (challengeRule === "failMinus1") {
      players = players.map((p) =>
        p.id === challengerId ? { ...p, score: Math.max(0, p.score - 1) } : p
      );
    }

    commit({
      ...state,
      players,
      lastResult: {
        ...lr,
        challengedById: challengerId,
        challengeResolved: true,
        challengeSucceeded: succeeded,
      },
    });
  }

  return (
    <div className="container">
      <div className="h1">Hitster KR (Host)</div>
      <div className="small">
        유튜브는 <b>직접 재생</b>하고, 이 웹은 <b>곡/연도 판정 & 플레이어 타임라인</b>만 담당합니다.
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900 }}>라운드</div>
            <div className="row">
              <span className="badge">덱 {state.deckSongIds.length}</span>
              <span className="badge">사용 {state.usedSongIds.length}</span>
            </div>
          </div>

          <div className="hr" />

          <div className="row">
            <button className="btn primary" onClick={drawSong} disabled={filteredDeck.length === 0}>
              다음 곡 뽑기
            </button>
            <button className="btn" onClick={openYouTube} disabled={!currentSong}>
              유튜브에서 검색 열기
            </button>
            <button className="btn" onClick={reveal} disabled={!currentSong || state.revealed}>
              정답 공개
            </button>

            <div className="row" style={{ marginLeft: "auto" }}>
              <span className="small">난이도</span>
              <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
                <option value="all">전체</option>
                <option value="easy">easy</option>
                <option value="normal">normal</option>
                <option value="hard">hard</option>
              </select>
            </div>
          </div>

          {state.mode === "teams" && (
            <>
              <div className="hr" />
              <div className="row" style={{ alignItems: "center", gap: 10 }}>
                <div className="small" style={{ fontWeight: 800 }}>팀전 규칙</div>
                <select
                  className="input"
                  value={roundRule}
                  onChange={(e) => {
                    const rr = e.target.value as RoundRule;
                    commit({ ...state, roundRule: rr, roundPlacedTeamIds: [], activeTeamId });
                  }}
                >
                  <option value="single">한 라운드에 한 팀만</option>
                  <option value="all">세 팀 모두 시도</option>
                </select>

                {roundRule === "single" && (
                  <>
                    <span className="small">이번 라운드 팀</span>
                    <select
                      className="input"
                      value={activeTeamId ?? ""}
                      onChange={(e) => commit({ ...state, activeTeamId: e.target.value })}
                    >
                      {state.players.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </>
                )}

                <span className="small">이의제기 페널티</span>
                <select
                  className="input"
                  value={challengeRule}
                  onChange={(e) => commit({ ...state, challengeRule: e.target.value as ChallengeRule })}
                >
                  <option value="noPenalty">실패해도 페널티 없음</option>
                  <option value="failMinus1">실패 시 -1점</option>
                </select>
              </div>

              {roundRule === "all" && (
                <div className="small" style={{ marginTop: 6 }}>
                  이번 곡에서 이미 시도한 팀: {Array.from(roundPlacedTeamIds).map((id) => state.players.find((p) => p.id === id)?.name).filter(Boolean).join(", ") || "없음"}
                </div>
              )}
            </>
          )}

          <div className="hr" />

          {!currentSong ? (
            <div className="small">“다음 곡 뽑기”를 눌러 시작하세요.</div>
          ) : (
            <DndContext onDragEnd={onDragEnd}>
              <div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 900 }}>현재 곡</div>
                <span className="badge">{state.revealed ? "REVEALED" : "HIDDEN"}</span>
              </div>

              <div className="hr" />

              <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
                <DraggableSongCard
                  id="current-song"
                  disabled={!currentSong || state.revealed}
                  title={state.revealed ? `${currentSong.artist} - ${currentSong.title}` : "??? - ???"}
                  subtitle={state.revealed ? `연도: ${currentSong.year}` : "정답 숨김 (20~30초만 들려주기)"}
                  meta={currentSong.difficulty}
                />
              </div>

              <div className="small" style={{ marginTop: 6 }}>
                {state.revealed ? (
                  <>정답 공개됨 — 발매 연도: <b className="mono">{currentSong.year}</b></>
                ) : (
                  <>위의 카드를 드래그해서 <b>팀/플레이어 타임라인</b>의 빈 칸에 놓으세요.</>
                )}
              </div>

              <div className="hr" />

              <div className="small" style={{ marginBottom: 8 }}>
                {state.mode === "teams" ? "3팀 타임라인" : "플레이어 타임라인"}에 드롭해서 배치합니다.
              </div>

              <div className="list">
                {state.players.map((p) => {
                  const sorted = [...p.timeline].sort((a, b) => a.year - b.year);
                  return (
                    <div key={p.id} className="timelineRow">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 900 }}>{p.name}</div>
                        <span className="badge">점수 {p.score}</span>
                      </div>
                      <div className="timelineStrip" role="list">
                        {Array.from({ length: sorted.length + 1 }, (_, i) => (
                          <React.Fragment key={i}>
                            <DropSlot
                              id={`drop:${p.id}:${i}`}
                              label={`${p.name} 위치 ${i}`}
                              disabled={!canDropFor(p.id)}
                            />
                            {i < sorted.length && (
                              <div className="timelineCard" role="listitem">
                                <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                                  <span className="yearPill">{sorted[i].year}</span>
                                </div>
                                <div style={{ fontWeight: 900, marginTop: 6 }}>
                                  {songsById[sorted[i].songId]?.title ?? ""}
                                </div>
                                <div className="songMeta">{songsById[sorted[i].songId]?.artist ?? ""}</div>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {state.lastResult && (
                <div className="hr" />
              )}

              {state.lastResult && (
                <div className="small">
                  마지막 판정:{" "}
                  <b>{state.players.find((p) => p.id === state.lastResult!.playerId)?.name ?? "?"}</b> —{" "}
                  {state.lastResult.ok ? "✅ 성공 (점수 +1)" : "❌ 실패 (점수 -1)"} / 연도{" "}
                  <b className="mono">{state.lastResult.actualYear}</b>
                </div>
              )}

              {state.mode === "teams" && state.lastResult && !state.lastResult.challengeResolved && (
                <>
                  <div className="hr" />
                  <div className="row" style={{ alignItems: "center", gap: 10 }}>
                    <div className="small" style={{ fontWeight: 800 }}>이의제기</div>
                    <select
                      className="input"
                      value={challengeBy || ""}
                      onChange={(e) => setChallengeBy(e.target.value)}
                    >
                      {state.players
                        .filter((p) => p.id !== state.lastResult!.playerId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <button className="btn primary" onClick={() => resolveChallenge(true)}>
                      이의제기 적용
                    </button>
                    <button className="btn" onClick={() => resolveChallenge(false)}>
                      이의제기 안함
                    </button>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    룰: 상대팀이 <b>연도 위치가 틀렸다고 이의제기</b>할 수 있습니다. 원래 배치가 틀렸다면 <b>이의제기 팀이 카드 획득(+1)</b>, 맞았다면{challengeRule === "failMinus1" ? " 이의제기 팀 -1" : " 페널티 없음"}.
                  </div>
                </>
              )}

              {state.mode === "teams" && state.lastResult?.challengeResolved && (
                <div className="small" style={{ marginTop: 8 }}>
                  이의제기 결과: {state.lastResult.challengedById ? (
                    <>
                      <b>{state.players.find((p) => p.id === state.lastResult!.challengedById)?.name ?? "?"}</b> —{" "}
                      {state.lastResult.challengeSucceeded ? "✅ 성공 (카드 가져감)" : "❌ 실패"}
                    </>
                  ) : (
                    <>이의제기 없음</>
                  )}
                </div>
              )}
              </div>
              <DragOverlay>
                {currentSong ? (
                  <div className="songToken overlay">
                    <div style={{ fontWeight: 900 }}>{state.revealed ? `${currentSong.artist} - ${currentSong.title}` : "??? - ???"}</div>
                    <div className="small">드롭해서 배치</div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900 }}>플레이어</div>
            <button className="btn danger" onClick={resetAll}>
              전체 초기화
            </button>
          </div>

          <div className="hr" />

          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="small" style={{ fontWeight: 800 }}>모드</div>
            <div className="row">
              <button className={"btn" + (state.mode === "players" ? " primary" : "")} onClick={startPlayersMode}>
                개인전
              </button>
              <button className={"btn" + (state.mode === "teams" ? " primary" : "")} onClick={startTeamsMode}>
                3팀전
              </button>
            </div>
          </div>

          <div className="hr" />

          <div className="row">
            <input
              className="input"
              placeholder="플레이어 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              disabled={state.mode === "teams"}
            />
            <button className="btn primary" onClick={addPlayer}>
              추가
            </button>
          </div>

          <div className="hr" />

          {state.players.length === 0 ? (
            <div className="small">{state.mode === "teams" ? "3팀전 버튼을 눌러 시작하세요." : "플레이어를 추가하세요."}</div>
          ) : (
            <div className="list">
              {state.players.map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  songsById={songsById}
                  onRename={(name) => {
                    const players = state.players.map((x) => (x.id === p.id ? { ...x, name } : x));
                    commit({ ...state, players });
                  }}
                />
              ))}
            </div>
          )}

          <div className="hr" />

          <div className="small">
            곡 리스트 파일: <span className="mono">src/data/songs.kr.2000_now.json</span> (원하면 여기서 곡/연도 수정 가능)
          </div>
        </div>
      </div>
    </div>
  );
}
