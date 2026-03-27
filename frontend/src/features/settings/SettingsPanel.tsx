import { KeyboardEvent, useState } from 'react';
import { DEFAULT_SETTINGS, SettingsState } from './settingsTypes';
import { SETTINGS_TAB_ITEMS, SettingsTabId } from './settingsTabs';
import { renderTabContent } from './settingsPanelSections';

type SettingsPanelProps = {
  value: SettingsState;
  onChange: (next: SettingsState) => void;
};

function getAdjacentTab(current: SettingsTabId, step: 1 | -1): SettingsTabId {
  const currentIndex = SETTINGS_TAB_ITEMS.findIndex((tab) => tab.id === current);
  const nextIndex = (currentIndex + step + SETTINGS_TAB_ITEMS.length) % SETTINGS_TAB_ITEMS.length;
  return SETTINGS_TAB_ITEMS[nextIndex].id;
}

export function SettingsPanel({ value, onChange }: SettingsPanelProps) {
  const current = value ?? DEFAULT_SETTINGS;
  const [activeTab, setActiveTab] = useState<SettingsTabId>('tool');

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: SettingsTabId) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    setActiveTab(getAdjacentTab(tabId, step));
  }

  return (
    <section className="settingsPanel">
      <header className="settingsTabs" role="tablist" aria-label="设置分组">
        {SETTINGS_TAB_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            id={`settings-tab-${item.id}`}
            aria-selected={activeTab === item.id}
            aria-controls={`settings-tab-panel-${item.id}`}
            className={activeTab === item.id ? 'settingsTabButton tabActive' : 'settingsTabButton'}
            onClick={() => setActiveTab(item.id)}
            onKeyDown={(event) => handleTabKeyDown(event, item.id)}
          >
            <svg className="tabIcon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={item.iconPath} />
            </svg>
            <span>{item.label}</span>
          </button>
        ))}
      </header>

      <div
        id={`settings-tab-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        className="settingsBody"
      >
        {renderTabContent(activeTab, current, onChange)}
      </div>
    </section>
  );
}
