import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { useThreadActions } from "../../hooks/useThreadActions";
import { useThreadShells } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import { useUiStateStore } from "../../uiStateStore";
import { ensureCard, type ArchiveViewMode } from "./canvasLayout";
import { resolveConversationStatus, STATUS_CLASS, statusLabel } from "./conversationStatus";

const CARD_WIDTH = 220;
const CARD_HEIGHT = 176;

export function ConversationCanvas() {
  const threads = useThreadShells();
  const layout = useUiStateStore((state) => state.canvasLayout);
  const lastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const moveCanvasCard = useUiStateStore((state) => state.moveCanvasCard);
  const completeCanvasCard = useUiStateStore((state) => state.completeCanvasCard);
  const noteCanvasCardTitle = useUiStateStore((state) => state.noteCanvasCardTitle);
  const setCanvasArchiveView = useUiStateStore((state) => state.setCanvasArchiveView);
  const setCanvasViewport = useUiStateStore((state) => state.setCanvasViewport);
  const addCanvasFile = useUiStateStore((state) => state.addCanvasFile);
  const moveCanvasFile = useUiStateStore((state) => state.moveCanvasFile);
  const linkCanvasFile = useUiStateStore((state) => state.linkCanvasFile);
  const { archiveThread, unarchiveThread } = useThreadActions();
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openTopicsKey, setOpenTopicsKey] = useState<string | null>(null);
  const dragRef = useRef<{
    kind: "card" | "file" | "pan" | "link";
    id: string;
    dx: number;
    dy: number;
    z: number;
  } | null>(null);

  useEffect(() => {
    threads.forEach((thread, index) => {
      noteCanvasCardTitle(
        scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
        thread.title,
        thread.updatedAt,
        index,
      );
    });
  }, [noteCanvasCardTitle, threads]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: node.clientWidth, height: node.clientHeight });
    });
    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  const active = threads.filter((thread) => thread.archivedAt === null);
  const archived = [...threads.filter((thread) => thread.archivedAt !== null)].sort((left, right) =>
    (right.archivedAt ?? "").localeCompare(left.archivedAt ?? ""),
  );
  const view = {
    x: -layout.viewport.x - 80,
    y: -layout.viewport.y - 80,
    width: size.width + 160,
    height: size.height + 160,
  };
  const mounted = useMemo(
    () =>
      active.filter((thread, index) => {
        const card = ensureCard(
          layout,
          scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
          index,
        );
        return (
          card.x + CARD_WIDTH > view.x &&
          card.x < view.x + view.width &&
          card.y + CARD_HEIGHT > view.y &&
          card.y < view.y + view.height
        );
      }),
    [active, layout, view.height, view.width, view.x, view.y],
  );

  function worldPoint(event: { clientX: number; clientY: number }) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: event.clientX - rect.left - layout.viewport.x,
      y: event.clientY - rect.top - layout.viewport.y,
    };
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm">
        <p className="text-muted-foreground">
          Mounted {mounted.length} of {active.length} shells. Transcripts stay closed until you open
          a card.
        </p>
        <button
          type="button"
          className="rounded-md border px-2 py-1"
          onClick={() => setArchiveOpen((open) => !open)}
        >
          Archive bin ({archived.length})
        </button>
      </div>
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-muted/30"
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const point = worldPoint(event);
          if (drag.kind === "pan") {
            setCanvasViewport(event.clientX - drag.dx, event.clientY - drag.dy);
            return;
          }
          if (drag.kind === "card") {
            moveCanvasCard(drag.id, point.x - drag.dx, point.y - drag.dy, drag.z);
          }
          if (drag.kind === "file") moveCanvasFile(drag.id, point.x - drag.dx, point.y - drag.dy);
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          dragRef.current = null;
          if (drag?.kind !== "link") return;
          const point = worldPoint(event);
          const hit = active.find((thread, index) => {
            const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
            const card = ensureCard(layout, key, index);
            return (
              point.x >= card.x &&
              point.x <= card.x + CARD_WIDTH &&
              point.y >= card.y &&
              point.y <= card.y + CARD_HEIGHT
            );
          });
          if (!hit) return;
          const threadKey = scopedThreadKey(scopeThreadRef(hit.environmentId, hit.id));
          linkCanvasFile({ id: `${drag.id}->${threadKey}`, fileId: drag.id, threadKey });
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const point = worldPoint(event);
          const files = [...event.dataTransfer.files];
          const names =
            files.length > 0
              ? files.map((file) => file.name)
              : [event.dataTransfer.getData("text/plain") || "note.md"];
          names.forEach((name, index) => {
            addCanvasFile({
              id: `${name}-${Date.now()}-${index}`,
              name,
              x: point.x + index * 24,
              y: point.y + index * 24,
              zIndex: 1,
            });
          });
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          dragRef.current = {
            kind: "pan",
            id: "viewport",
            dx: event.clientX - layout.viewport.x,
            dy: event.clientY - layout.viewport.y,
            z: 0,
          };
        }}
      >
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${layout.viewport.x}px, ${layout.viewport.y}px)` }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 h-[4000px] w-[4000px] overflow-visible">
            {layout.edges.map((edge) => {
              const file = layout.files.find((item) => item.id === edge.fileId);
              const threadIndex = active.findIndex(
                (thread) =>
                  scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)) ===
                  edge.threadKey,
              );
              if (!file || threadIndex < 0) return null;
              const card = ensureCard(layout, edge.threadKey, threadIndex);
              return (
                <line
                  key={edge.id}
                  x1={file.x + 70}
                  y1={file.y + 24}
                  x2={card.x}
                  y2={card.y + 36}
                  className="stroke-primary"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
          {layout.files.map((file) => (
            <div
              key={file.id}
              className="absolute w-36 rounded-md border bg-background p-2 text-xs shadow-md"
              style={{ left: file.x, top: file.y }}
              onPointerDown={(event) => {
                const point = worldPoint(event);
                dragRef.current = {
                  kind: "file",
                  id: file.id,
                  dx: point.x - file.x,
                  dy: point.y - file.y,
                  z: file.zIndex,
                };
              }}
            >
              <p className="truncate font-medium">{file.name}</p>
              <button
                type="button"
                className="mt-1 rounded border px-1"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  dragRef.current = { kind: "link", id: file.id, dx: 0, dy: 0, z: 0 };
                }}
              >
                Link to chat
              </button>
            </div>
          ))}
          {mounted.map((thread) => {
            const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
            const index = active.indexOf(thread);
            const card = ensureCard(layout, threadKey, index);
            const status = resolveConversationStatus({
              sessionStatus: thread.session?.status ?? null,
              backgroundLiveness: thread.backgroundLiveness ?? null,
              snoozedUntil: thread.snoozedUntil ?? null,
              hasPendingApprovals: thread.hasPendingApprovals,
              hasPendingUserInput: thread.hasPendingUserInput,
              hasActionableProposedPlan: thread.hasActionableProposedPlan,
              updatedAt: thread.updatedAt,
              lastVisitedAt: lastVisitedAtById[threadKey] ?? lastVisitedAtById[thread.id] ?? null,
              userCompletedAt: card.userCompletedAt,
            });
            const blurb =
              thread.planProgress?.step ??
              thread.branch ??
              "Shell only. Open the chat for the transcript.";
            return (
              <article
                key={threadKey}
                className="absolute w-[220px] rounded-lg border bg-background p-2 shadow-md"
                style={{ left: card.x, top: card.y, zIndex: card.zIndex }}
                onPointerDown={(event) => {
                  const point = worldPoint(event);
                  const top =
                    Math.max(...Object.values(layout.cards).map((item) => item.zIndex), 0) + 1;
                  moveCanvasCard(threadKey, card.x, card.y, top);
                  dragRef.current = {
                    kind: "card",
                    id: threadKey,
                    dx: point.x - card.x,
                    dy: point.y - card.y,
                    z: top,
                  };
                }}
              >
                <p
                  className={`flex items-center gap-1 text-[10px] font-medium ${STATUS_CLASS[status]}`}
                >
                  <span className="size-2 rounded-full bg-current" />
                  {statusLabel(status)}
                </p>
                <div className="mt-1 h-14 rounded bg-muted" aria-hidden="true" />
                <h2 className="mt-1 truncate text-sm font-medium">{thread.title}</h2>
                <p className="line-clamp-2 text-xs text-muted-foreground">{blurb}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Link
                    className="text-xs underline"
                    to="/$environmentId/$threadId"
                    params={buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id))}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    className="text-xs underline"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() =>
                      setOpenTopicsKey((key) => (key === threadKey ? null : threadKey))
                    }
                  >
                    Topics
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => completeCanvasCard(threadKey, new Date().toISOString())}
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      void archiveThread(scopeThreadRef(thread.environmentId, thread.id));
                    }}
                  >
                    Archive
                  </button>
                </div>
                {openTopicsKey === threadKey ? (
                  <ol className="mt-1 list-decimal pl-4 text-xs">
                    <li>{thread.title}</li>
                    {card.topics.map((topic) => (
                      <li key={`${topic.changedAt}-${topic.title}`}>{topic.title}</li>
                    ))}
                  </ol>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
      {archiveOpen ? (
        <ArchiveBin
          mode={layout.archiveViewMode}
          threads={archived}
          layout={layout}
          onMode={setCanvasArchiveView}
          onClose={() => setArchiveOpen(false)}
          onRestore={(thread) => {
            const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
            const card = ensureCard(layout, key, 0);
            const top = Math.max(...Object.values(layout.cards).map((item) => item.zIndex), 0) + 1;
            moveCanvasCard(key, card.x, card.y, top);
            void unarchiveThread(scopeThreadRef(thread.environmentId, thread.id));
          }}
        />
      ) : null}
    </div>
  );
}

function ArchiveBin({
  mode,
  threads,
  layout,
  onMode,
  onClose,
  onRestore,
}: {
  mode: ArchiveViewMode;
  threads: ReturnType<typeof useThreadShells>;
  layout: ReturnType<typeof useUiStateStore.getState>["canvasLayout"];
  onMode: (mode: ArchiveViewMode) => void;
  onClose: () => void;
  onRestore: (thread: (typeof threads)[number]) => void;
}) {
  return (
    <aside className="absolute inset-y-12 right-0 z-20 flex w-[min(28rem,100%)] flex-col border-l bg-background">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-medium">Archive bin</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex gap-2 px-3 pb-2" role="tablist">
        {(["spatial", "grid", "list"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            className="rounded border px-2 py-1 text-xs capitalize"
            onClick={() => onMode(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div
        className={`relative min-h-0 flex-1 overflow-auto p-3 ${mode === "grid" ? "grid grid-cols-2 gap-2" : ""}`}
      >
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing archived.</p>
        ) : null}
        {threads.map((thread, index) => {
          const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
          const card = ensureCard(layout, key, index);
          return (
            <article
              key={key}
              className="rounded-md border p-2 text-sm"
              style={
                mode === "spatial"
                  ? {
                      position: "absolute",
                      left: card.x,
                      top: card.y,
                      zIndex: threads.length - index,
                      width: 200,
                    }
                  : undefined
              }
            >
              <h3 className="font-medium">{thread.title}</h3>
              <button type="button" className="text-xs underline" onClick={() => onRestore(thread)}>
                Restore
              </button>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
