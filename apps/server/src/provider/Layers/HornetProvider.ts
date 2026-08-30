import {
  type HornetSettings,
  type ModelCapabilities,
  type ServerProviderModel,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { createModelCapabilities } from "@t3tools/shared/model";

import {
  buildServerProvider,
  providerModelsFromSettings,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";

const HORNET_PRESENTATION = {
  displayName: "Hornet",
  badgeLabel: "Early Access",
  showInteractionModeToggle: false,
} as const;

const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});

const HORNET_BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "z-ai/glm-5.3-flash",
    name: "GLM 5.3 Flash",
    isCustom: false,
    capabilities: EMPTY_CAPABILITIES,
  },
  {
    slug: "z-ai/glm-5.3",
    name: "GLM 5.3",
    isCustom: false,
    capabilities: EMPTY_CAPABILITIES,
  },
  {
    slug: "minimax/minimax-m3",
    name: "MiniMax M3",
    isCustom: false,
    capabilities: EMPTY_CAPABILITIES,
  },
  {
    slug: "moonshotai/kimi-k3",
    name: "Kimi K3",
    isCustom: false,
    capabilities: EMPTY_CAPABILITIES,
  },
  {
    slug: "deepseek/deepseek-chat",
    name: "DeepSeek Chat",
    isCustom: false,
    capabilities: EMPTY_CAPABILITIES,
  },
];

function normalizeBaseUrl(serverUrl: string): string {
  const trimmed = serverUrl.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : "http://127.0.0.1:8765";
}

function hornetModels(settings: HornetSettings): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(
    HORNET_BUILT_IN_MODELS,
    settings.customModels ?? [],
    EMPTY_CAPABILITIES,
  );
}

export function makePendingHornetProvider(
  settings: HornetSettings,
): Effect.Effect<ServerProviderDraft> {
  return Effect.gen(function* () {
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = hornetModels(settings);
    if (!settings.enabled) {
      return buildServerProvider({
        presentation: HORNET_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Hornet is disabled in T3 Code settings.",
        },
      });
    }
    return buildServerProvider({
      presentation: HORNET_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "Checking Hornet desk…",
      },
    });
  });
}

export function checkHornetProviderStatus(
  settings: HornetSettings,
): Effect.Effect<ServerProviderDraft, never, HttpClient.HttpClient> {
  return Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const checkedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);
    const models = hornetModels(settings);
    const baseUrl = normalizeBaseUrl(settings.serverUrl);

    if (!settings.enabled) {
      return buildServerProvider({
        presentation: HORNET_PRESENTATION,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "Hornet is disabled in T3 Code settings.",
        },
      });
    }

    const unreachable = buildServerProvider({
      presentation: HORNET_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: `Couldn't reach Hornet at ${baseUrl}. Run \`hornet serve <chat-root>\` on this machine.`,
      },
    });

    const body = yield* http.execute(HttpClientRequest.get(`${baseUrl}/api/health`)).pipe(
      Effect.flatMap((response) => response.json),
      Effect.timeout("3 seconds"),
      Effect.orElseSucceed(() => null),
    );

    if (body === null || typeof body !== "object") {
      return unreachable;
    }

    const record = body as { readonly ok?: boolean; readonly version?: string };
    const version = typeof record.version === "string" ? record.version : null;
    return buildServerProvider({
      presentation: HORNET_PRESENTATION,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: true,
        version,
        status: record.ok === true ? "ready" : "warning",
        auth: { status: "authenticated", type: "hornet" },
        message:
          record.ok === true
            ? `Hornet desk reachable at ${baseUrl}.`
            : `Hornet responded unexpectedly from ${baseUrl}.`,
      },
    });
  });
}
