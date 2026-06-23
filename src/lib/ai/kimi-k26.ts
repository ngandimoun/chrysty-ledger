/** Default Kimi model for this app. See https://platform.kimi.ai/docs/llms.txt */
export const KIMI_K26_MODEL = "kimi-k2.6";

/** Kimi default max_tokens for k2.6/k2.5/k2.7-code. */
export const DEFAULT_MAX_TOKENS = 32768;

/** Minimum max_tokens when using tools with thinking models. */
export const MIN_MAX_TOKENS_FOR_TOOLS = 16000;

/**
 * kimi-k2.6 uses fixed sampling params — do not pass temperature, top_p, n,
 * presence_penalty, or frequency_penalty (non-default values error).
 */
