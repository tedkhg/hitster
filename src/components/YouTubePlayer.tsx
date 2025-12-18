import { useEffect, useRef } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string | null;
  onReady?: () => void;
  onEnd?: () => void;
}

export default function YouTubePlayer({ videoId, onReady, onEnd }: YouTubePlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 100);
        return;
      }

      // 기존 플레이어 정리
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.error("Failed to destroy player:", e);
        }
        playerRef.current = null;
      }

      // 타이머 정리
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // 컨테이너 초기화
      if (containerRef.current) {
        containerRef.current.innerHTML = '<div id="youtube-player"></div>';
      }

      // 새 플레이어 생성
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "1",
        width: "1",
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
            onReady?.();

            // 1분(60초) 후 자동으로 정지
            timerRef.current = setTimeout(() => {
              if (playerRef.current) {
                try {
                  playerRef.current.pauseVideo();
                  onEnd?.();
                } catch (e) {
                  console.error("Failed to pause video:", e);
                }
              }
            }, 60000);
          },
          onStateChange: (event: any) => {
            // 영상이 끝났을 때
            if (event.data === window.YT.PlayerState.ENDED) {
              onEnd?.();
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (playerRef.current) {
        try {
          playerRef.current.pauseVideo();
          playerRef.current.destroy();
        } catch (e) {
          console.error("Failed to cleanup player:", e);
        }
      }
    };
  }, [videoId, onReady, onEnd]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: "1px",
        height: "1px",
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
      }}
    >
      <div id="youtube-player"></div>
    </div>
  );
}
