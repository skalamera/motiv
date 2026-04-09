/** User-selected retrieval sources for Ask Motiv (sent with each `/api/chat` request). */
export type ChatSourcePreferences = {
  web: boolean;
  owner: boolean;
  service: boolean;
  otherDocs: boolean;
  workshop: boolean;
};

export const DEFAULT_CHAT_SOURCE_PREFERENCES: ChatSourcePreferences = {
  web: true,
  owner: true,
  service: true,
  otherDocs: true,
  workshop: true,
};

export function normalizeChatSourcePreferences(
  raw: Partial<ChatSourcePreferences> | undefined | null,
): ChatSourcePreferences {
  return {
    web: raw?.web !== false,
    owner: raw?.owner !== false,
    service: raw?.service !== false,
    otherDocs: raw?.otherDocs !== false,
    workshop: raw?.workshop !== false,
  };
}
