"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_CHAT_SOURCE_PREFERENCES,
  type ChatSourcePreferences,
} from "@/types/chat-sources";

export type CarDocMeta = {
  hasOwner: boolean;
  hasService: boolean;
  hasOther: boolean;
  hasWorkshop: boolean;
};

export function sourcePrefsStorageKey(carId: string | null): string {
  return `motiv-chat-source-prefs:${carId ?? "any"}`;
}

/**
 * Persists per-vehicle source toggles (localStorage) and loads which manuals exist.
 */
export function useChatSourcePreferences(carId: string | null) {
  const [sourcePrefs, setSourcePrefs] = useState<ChatSourcePreferences>(
    DEFAULT_CHAT_SOURCE_PREFERENCES,
  );
  const sourcePrefsRef = useRef(sourcePrefs);
  sourcePrefsRef.current = sourcePrefs;

  const [docMeta, setDocMeta] = useState<CarDocMeta | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(sourcePrefsStorageKey(carId));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ChatSourcePreferences>;
        setSourcePrefs({
          ...DEFAULT_CHAT_SOURCE_PREFERENCES,
          ...parsed,
        });
      } else {
        setSourcePrefs(DEFAULT_CHAT_SOURCE_PREFERENCES);
      }
    } catch {
      setSourcePrefs(DEFAULT_CHAT_SOURCE_PREFERENCES);
    }
  }, [carId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        sourcePrefsStorageKey(carId),
        JSON.stringify(sourcePrefs),
      );
    } catch {
      // ignore
    }
  }, [carId, sourcePrefs]);

  useEffect(() => {
    if (!carId) {
      setDocMeta(null);
      return;
    }
    const supabase = createClient();
    void Promise.all([
      supabase.from("cars").select("car_library_key").eq("id", carId).maybeSingle(),
      supabase.from("manuals").select("manual_kind").eq("car_id", carId),
    ]).then(([carRes, manRes]) => {
      const rows = manRes.data ?? [];
      setDocMeta({
        hasOwner: rows.some((r) => r.manual_kind === "owner"),
        hasService: rows.some((r) => r.manual_kind === "maintenance"),
        hasOther: rows.some((r) => r.manual_kind === "other"),
        hasWorkshop: Boolean(carRes.data?.car_library_key?.trim()),
      });
    });
  }, [carId]);

  return { sourcePrefs, setSourcePrefs, sourcePrefsRef, docMeta };
}
