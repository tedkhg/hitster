export type Difficulty = "easy" | "normal" | "hard";

export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  difficulty: Difficulty;
  youtubeQuery: string;
  videoId?: string; // YouTube 비디오 ID (선택적)
}

export interface TimelineCard {
  songId: string;
  year: number;
  revealed: boolean; // 정답을 맞춰서 공개된 카드인지 여부
}

export type RoundRule = "single" | "all";
export type ChallengeRule = "noPenalty" | "failMinus1";

export interface Player {
  id: string;
  name: string;
  score: number;
  timeline: TimelineCard[];
}

export interface GameState {
  mode: "players" | "teams";
  players: Player[];
  deckSongIds: string[];
  usedSongIds: string[];
  currentSongId: string | null;
  revealed: boolean;
  // teams/round rules
  roundRule?: RoundRule;
  activeTeamId?: string | null;
  roundPlacedTeamIds?: string[];
  challengeRule?: ChallengeRule;

  lastResult?: {
    playerId: string;
    ok: boolean;
    songId: string;
    placedYear: number;
    actualYear: number;
    insertedIndex: number;
    guessedYear?: number; // 플레이어가 입력한 연도
    challengedById?: string;
    challengeResolved?: boolean;
    challengeSucceeded?: boolean;
    challengerGuessedYear?: number; // 이의제기 팀이 입력한 연도
  };
}
