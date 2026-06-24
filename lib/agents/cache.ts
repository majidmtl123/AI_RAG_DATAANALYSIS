import type { SystemModelMessage } from "ai";

/**
 * Wrap a system prompt string in a SystemModelMessage with an Anthropic prompt
 * caching breakpoint. Anthropic caches the prefix up to this point; subsequent
 * requests with the same prefix (e.g. follow-up questions in a conversation)
 * read from cache instead of reprocessing the whole system prompt.
 *
 * Uses a 1-hour TTL since a dataset conversation typically spans many minutes.
 * See: providerOptions.anthropic.cacheControl = { type: 'ephemeral', ttl: '1h' }.
 */
export function cachedSystem(content: string): SystemModelMessage {
  return {
    role: "system",
    content,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } },
    },
  };
}
