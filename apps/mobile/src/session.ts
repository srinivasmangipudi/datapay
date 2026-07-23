import * as SecureStore from "expo-secure-store";

const KEY = "datapay.session";

export interface Session {
  token: string;
  aliasId: string;
  displayAlias: string;
  zoneId: string;
  locale: string;
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
