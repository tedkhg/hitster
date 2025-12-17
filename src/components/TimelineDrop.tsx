import React from "react";
import { useDroppable } from "@dnd-kit/core";

export function DropSlot({ id, label, disabled }: { id: string; label?: string; disabled?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={"dropSlot" + (disabled ? " disabled" : "") + (isOver ? " over" : "")}
      aria-label={label}
      title={label}
    />
  );
}
