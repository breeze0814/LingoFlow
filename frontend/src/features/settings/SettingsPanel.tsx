import { KeyboardEvent, ReactNode, useState } from 'react';
import { DEFAULT_SETTINGS, SettingsState } from './settingsTypes';
import { SETTINGS_TAB_ITEMS, SettingsTabId } from './settingsTabs';
import { renderTabContent } from './settingsPanelSections';

const HIDDEN_TOOL_PROVIDER_IDS = new Set(['localOcr']);

type SettingsPanelProps = {
  value: SettingsState;
  onChange: (next: SettingsState) => void;
};

function getAdjacentTab(current: SettingsTabId, step: 1 | -1): SettingsTabId {
  const currentIndex = SETTINGS_TAB_ITEMS.findIndex((tab) => tab.id === current);
  const nextIndex = (currentIndex + step + SETTINGS_TAB_ITEMS.length) % SETTINGS_TAB_ITEMS.length;
  return SETTINGS_TAB_ITEMS[nextIndex].id;
}

function getActiveItem(tabId: SettingsTabId) {
  const item = SETTINGS_TAB_ITEMS.find((tab) => tab.id === tabId);
  if (!item) {
    throw new Error(`unknown settings tab: ${tabId}`);
  }
  return item;
}

function getTabStatus(tabId: SettingsTabId, value: SettingsState): string {
  if (tabId === 'tool') {
    const enabledCount = Object.entries(value.providers).filter(
      ([providerId, item]) => !HIDDEN_TOOL_PROVIDER_IDS.has(providerId) && item.enabled,
    ).length;
    return `${enabledCount} 个工具已启用`;
  }
  if (tabId === 'general') {
    return `${value.primaryLanguage} -> ${value.secondaryLanguage}`;
  }
  if (tabId === 'service') {
    const enabledCount = [
      value.autoQueryOnSelection,
      value.autoQueryOnOcr,
      value.autoQueryOnPaste,
      value.autoSpeakEnglishWord,
      value.autoCopyResult,
      value.httpApiEnabled,
    ].filter(Boolean).length;
    return `${enabledCount} 项自动化已开启`;
  }
  return `${Object.keys(value.shortcuts).length} 组快捷键`;
}

type SettingsTabButtonProps = {
  active: boolean;
  item: (typeof SETTINGS_TAB_ITEMS)[number];
  onActivate: (tabId: SettingsTabId) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tabId: SettingsTabId) => void;
};

function SettingsTabButton(props: SettingsTabButtonProps) {
  const className = props.active
    ? 'settingsTabButton settingsTabButtonActive'
    : 'settingsTabButton';

  return (
    <button
      type="button"
      role="tab"
      id={`settings-tab-${props.item.id}`}
      aria-label={props.item.label}
      aria-selected={props.active}
      aria-controls={`settings-tab-panel-${props.item.id}`}
      className={className}
      onClick={() => props.onActivate(props.item.id)}
      onKeyDown={(event) => props.onKeyDown(event, props.item.id)}
    >
      <span className="settingsTabIconShell" aria-hidden="true">
        <svg className="tabIcon" viewBox="0 0 24 24">
          <path d={props.item.iconPath} />
        </svg>
      </span>
      <span className="settingsTabText">
        <span className="settingsTabLabelRow">{props.item.label}</span>
      </span>
    </button>
  );
}

type SettingsWindowBarProps = {
  activeTab: SettingsTabId;
  onActivate: (tabId: SettingsTabId) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tabId: SettingsTabId) => void;
};

function SettingsWindowBar(props: SettingsWindowBarProps) {
  return (
    <header className="settingsWindowBar">
      <div className="settingsWindowHeading">
        <span className="settingsWindowMark" aria-hidden="true" />
        <div className="settingsWindowTitleBlock">
          <h1>偏好设置</h1>
        </div>
      </div>
      <nav
        className="settingsWindowBarTabs"
        role="tablist"
        aria-label="设置分组"
        aria-orientation="horizontal"
      >
        {SETTINGS_TAB_ITEMS.map((item) => (
          <SettingsTabButton
            key={item.id}
            item={item}
            active={props.activeTab === item.id}
            onActivate={props.onActivate}
            onKeyDown={props.onKeyDown}
          />
        ))}
      </nav>
    </header>
  );
}

type SettingsContentPaneProps = {
  activeTab: SettingsTabId;
  children: ReactNode;
  value: SettingsState;
};

function SettingsContentPane(props: SettingsContentPaneProps) {
  const activeItem = getActiveItem(props.activeTab);

  return (
    <section className="settingsContentPane">
      <header className="settingsContentHeader">
        <h2>{activeItem.label}</h2>
        <span className="settingsContentStatus" aria-hidden="true">
          {getTabStatus(props.activeTab, props.value)}
        </span>
      </header>
      <div
        id={`settings-tab-panel-${props.activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${props.activeTab}`}
        className="settingsBody"
      >
        {props.children}
      </div>
    </section>
  );
}

export function SettingsPanel({ value, onChange }: SettingsPanelProps) {
  const current = value ?? DEFAULT_SETTINGS;
  const [activeTab, setActiveTab] = useState<SettingsTabId>('tool');

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: SettingsTabId) {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'ArrowDown'
    ) {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    setActiveTab(getAdjacentTab(tabId, step));
  }

  return (
    <section className="settingsPanel">
      <SettingsWindowBar
        activeTab={activeTab}
        onActivate={setActiveTab}
        onKeyDown={handleTabKeyDown}
      />
      <div className="settingsShell">
        <SettingsContentPane activeTab={activeTab} value={current}>
          {renderTabContent(activeTab, current, onChange)}
        </SettingsContentPane>
      </div>
    </section>
  );
}
