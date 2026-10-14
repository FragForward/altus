import { nanoid } from "nanoid";

export type TabService = "whatsapp" | "slack";

export const TabServices: { id: TabService; name: string; url: string }[] = [
  { id: "whatsapp", name: "WhatsApp", url: "https://web.whatsapp.com" },
  { id: "slack", name: "Slack", url: "https://app.slack.com/client" },
];

/** Service of a tab; tabs created before services existed are WhatsApp. */
export const getTabService = (tab: Tab): TabService => tab.service ?? "whatsapp";

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
