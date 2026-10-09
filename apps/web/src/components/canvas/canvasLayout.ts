export interface CanvasTopicBookmark {
  title: string;
  changedAt: string;
}

export interface CanvasCardPlacement {
  x: number;
  y: number;
  zIndex: number;
  userCompletedAt: string | null;
  lastSeenTitle: string | null;
  topics: CanvasTopicBookmark[];
}

export interface CanvasFileNode {
  id: string;
  name: string;
  x: number;
  y: number;
  zIndex: number;
}

export interface CanvasPromptEdge {
  id: string;
  fileId: string;
  threadKey: string;
}

export type ArchiveViewMode = "spatial" | "grid" | "list";

export interface CanvasLayout {
  cards: Record<string, CanvasCardPlacement>;
  files: CanvasFileNode[];
  edges: CanvasPromptEdge[];
  viewport: { x: number; y: number; zoom: number };
  archiveViewMode: ArchiveViewMode;
}

export const EMPTY_CANVAS_LAYOUT: CanvasLayout = {
  cards: {},
  files: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  archiveViewMode: "spatial",
};

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function sanitizeCanvasLayout(value: unknown): CanvasLayout {
  if (!value || typeof value !== "object") return EMPTY_CANVAS_LAYOUT;
  const raw = value as Partial<CanvasLayout>;
  const cards: CanvasLayout["cards"] = {};
  if (raw.cards && typeof raw.cards === "object") {
    for (const [key, card] of Object.entries(raw.cards)) {
      if (!key || !card || typeof card !== "object") continue;
      const topics = Array.isArray(card.topics)
        ? card.topics.flatMap((topic) =>
            topic &&
            typeof topic === "object" &&
            typeof topic.title === "string" &&
            typeof topic.changedAt === "string"
              ? [{ title: topic.title, changedAt: topic.changedAt }]
              : [],
          )
        : [];
      cards[key] = {
        x: finite(card.x, 0),
        y: finite(card.y, 0),
        zIndex: finite(card.zIndex, 1),
        userCompletedAt: typeof card.userCompletedAt === "string" ? card.userCompletedAt : null,
        lastSeenTitle: typeof card.lastSeenTitle === "string" ? card.lastSeenTitle : null,
        topics,
      };
    }
  }
  const files = Array.isArray(raw.files)
    ? raw.files.flatMap((file) =>
        file && typeof file.id === "string" && typeof file.name === "string"
          ? [
              {
                id: file.id,
                name: file.name,
                x: finite(file.x, 0),
                y: finite(file.y, 0),
                zIndex: finite(file.zIndex, 1),
              },
            ]
          : [],
      )
    : [];
  const edges = Array.isArray(raw.edges)
    ? raw.edges.flatMap((edge) =>
        edge && typeof edge.fileId === "string" && typeof edge.threadKey === "string"
          ? [
              {
                id: `${edge.fileId}->${edge.threadKey}`,
                fileId: edge.fileId,
                threadKey: edge.threadKey,
              },
            ]
          : [],
      )
    : [];
  const mode = raw.archiveViewMode;
  return {
    cards,
    files,
    edges,
    viewport: {
      x: finite(raw.viewport?.x, 0),
      y: finite(raw.viewport?.y, 0),
      zoom: finite(raw.viewport?.zoom, 1) || 1,
    },
    archiveViewMode: mode === "grid" || mode === "list" || mode === "spatial" ? mode : "spatial",
  };
}

export function ensureCard(
  layout: CanvasLayout,
  threadKey: string,
  index: number,
): CanvasCardPlacement {
  return (
    layout.cards[threadKey] ?? {
      x: 24 + (index % 4) * 248,
      y: 24 + Math.floor(index / 4) * 210,
      zIndex: index + 1,
      userCompletedAt: null,
      lastSeenTitle: null,
      topics: [],
    }
  );
}

export function noteCanvasTitle(
  layout: CanvasLayout,
  threadKey: string,
  title: string,
  changedAt: string,
  index: number,
): CanvasLayout {
  const current = ensureCard(layout, threadKey, index);
  if (current.lastSeenTitle === title && layout.cards[threadKey]) return layout;
  const topics =
    current.lastSeenTitle && current.lastSeenTitle !== title
      ? [{ title: current.lastSeenTitle, changedAt }, ...current.topics]
      : current.topics;
  return {
    ...layout,
    cards: {
      ...layout.cards,
      [threadKey]: { ...current, lastSeenTitle: title, topics },
    },
  };
}
