import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export default function DraggableSongCard({
  id,
  disabled,
  title,
  subtitle,
  meta,
}: {
  id: string;
  disabled?: boolean;
  title: string;
  subtitle?: string;
  meta?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} className={"songToken" + (disabled ? " disabled" : "")} {...listeners} {...attributes}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {subtitle && <div className="small">{subtitle}</div>}
      {meta && (
        <div className="row" style={{ marginTop: 6 }}>
          <span className="badge">{meta}</span>
        </div>
      )}
      <div className="tiny" style={{ marginTop: 6 }}>
        (드래그해서 팀/플레이어 타임라인의 빈 칸에 놓기)
      </div>
    </div>
  );
}
