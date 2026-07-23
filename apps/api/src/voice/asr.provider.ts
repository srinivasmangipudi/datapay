export interface AsrProvider {
  transcribe(audioBase64: string, language: string): Promise<{ text: string }>;
}

/**
 * DEV ONLY — no real Bhashini ASR client is wired up yet. Returns a canned,
 * empty transcript and does not perform any actual speech recognition. "Voice
 * input" is not a real claim until this is swapped for a real provider.
 */
export class DevNoopAsrProvider implements AsrProvider {
  async transcribe(): Promise<{ text: string }> {
    return { text: "" };
  }
}
