import { nanoid } from "nanoid";

export type TabService = "whatsapp" | "slack";

export const TabServices: { id: TabService; name: string; url: string }[] = [
  { id: "whatsapp", name: "WhatsApp", url: "https://web.whatsapp.com" },
  { id: "slack", name: "Slack", url: "https://app.slack.com/client" },
];

/** Service of a tab; tabs created before services existed are WhatsApp. */
export const getTabService = (tab: Tab): TabService => tab.service ?? "whatsapp";

/**
 * Slack refuses the Chrome version bundled with Electron. Pretend to be the
 * current stable Chrome (a new major every four weeks since 134 on 2025-03-04).
 */
export const getSlackChromeMajor = (): number => {
  const weeks = (Date.now() - Date.UTC(2025, 2, 4)) / (7 * 24 * 3600 * 1000);
  return 134 + Math.max(0, Math.floor(weeks / 4) - 1);
};

export const getSlackUserAgent = (): string => {
  const major = getSlackChromeMajor();
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
};

export const getTabUrl = (tab: Tab): string =>
  TabServices.find((s) => s.id === getTabService(tab))?.url ?? TabServices[0].url;

export type Tab = {
  id: string;
  name: string;
  service?: TabService;
  messageCount?: number;
  config: {
    theme: string;
    media: boolean;
    notifications: boolean;
    sound: boolean;
    color: string | null;
    spellChecker: boolean;
  };
};

export type TabStore = {
  tabs: Tab[];
  previouslyClosedTab: Tab | null;
  selectedTabId: string | undefined;
};

export const getDefaultTab = (): Tab => ({
  id: nanoid(),
  name: "New Tab",
  messageCount: 0,
  config: {
    theme: "dark",
    notifications: true,
    media: true,
    sound: true,
    color: null,
    spellChecker: true,
  },
});

export const TabStoreDefaults = (): TabStore => ({
  tabs: [],
  previouslyClosedTab: null,
  selectedTabId: undefined,
});

export type ElectronTabStoreIpcApi = {
  getStore: () => Promise<TabStore>;
  set: <T extends keyof TabStore>(key: T, value: TabStore[T]) => Promise<void>;
};
