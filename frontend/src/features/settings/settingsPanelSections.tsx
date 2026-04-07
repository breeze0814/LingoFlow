import { ReactNode } from 'react';
import {
  DETECTION_OPTIONS,
  DEFAULT_TOOL_PROVIDERS,
  LANGUAGE_OPTIONS,
  OCR_PANEL_POSITION_OPTIONS,
  SettingsState,
  ShortcutId,
  ToolProviderConfig,
  ToolProviderId,
  VOICE_OPTIONS,
} from './settingsTypes';
import { SettingsTabId } from './settingsTabs';
import { ShortcutPanel } from './ShortcutPanel';
import { ProviderPanel } from './ProviderPanel';

type SelectRowProps = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

type ToggleRowProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

type SettingsUpdater = (next: SettingsState) => void;

function SettingLabelBlock(props: { label: string }) {
  return (
    <span className="settingTextBlock">
      <span className="settingLabelRow">
        <span className="settingLabel">{props.label}</span>
      </span>
    </span>
  );
}

function SelectRow({ label, value, options, onChange }: SelectRowProps) {
  return (
    <label className="settingRow">
      <SettingLabelBlock label={label} />
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <label className="settingRow settingSwitchRow">
      <SettingLabelBlock label={label} />
      <button
        type="button"
        aria-label={label}
        aria-pressed={checked}
        className={`switch ${checked ? 'switchOn' : 'switchOff'}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switchKnob" />
      </button>
    </label>
  );
}

function Section(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="settingsSection">
      <header className="settingsSectionHeader">
        <h3>{props.title}</h3>
        {props.description ? (
          <p className="settingsSectionDescription">{props.description}</p>
        ) : null}
      </header>
      <div className="settingsGroup">{props.children}</div>
    </section>
  );
}

function updateSettings(
  value: SettingsState,
  onChange: SettingsUpdater,
  key: keyof SettingsState,
  nextValue: string | boolean,
) {
  onChange({
    ...value,
    [key]: nextValue,
  });
}

function updateShortcutSetting(
  value: SettingsState,
  onChange: SettingsUpdater,
  key: ShortcutId,
  nextValue: string,
) {
  onChange({
    ...value,
    shortcuts: {
      ...value.shortcuts,
      [key]: nextValue,
    },
  });
}

function updateProviderSetting(
  value: SettingsState,
  onChange: SettingsUpdater,
  key: ToolProviderId,
  patch: Partial<ToolProviderConfig>,
) {
  const currentProvider = value.providers[key] ?? DEFAULT_TOOL_PROVIDERS[key];
  onChange({
    ...value,
    providers: {
      ...value.providers,
      [key]: {
        ...currentProvider,
        ...patch,
      },
    },
  });
}

function renderGeneralTab(current: SettingsState, onChange: SettingsUpdater) {
  return (
    <>
      <Section
        title="查询语言"
        description="设置默认语种方向和识别策略，决定翻译工作区的初始行为。"
      >
        <SelectRow
          label="第一语言"
          value={current.primaryLanguage}
          options={LANGUAGE_OPTIONS}
          onChange={(next) => updateSettings(current, onChange, 'primaryLanguage', next)}
        />
        <SelectRow
          label="第二语言"
          value={current.secondaryLanguage}
          options={LANGUAGE_OPTIONS}
          onChange={(next) => updateSettings(current, onChange, 'secondaryLanguage', next)}
        />
        <SelectRow
          label="语种识别"
          value={current.detectionMode}
          options={DETECTION_OPTIONS}
          onChange={(next) => updateSettings(current, onChange, 'detectionMode', next)}
        />
      </Section>

      <Section title="输入框" description="微调主窗口打开、提交和保留结果时的交互细节。">
        <ToggleRow
          label="输入翻译时，清空查询内容"
          checked={current.clearInputOnTranslate}
          onChange={(next) => updateSettings(current, onChange, 'clearInputOnTranslate', next)}
        />
        <ToggleRow
          label="打开窗口时自动选中查询文本"
          checked={current.autoSelectQueryTextOnOpen}
          onChange={(next) => updateSettings(current, onChange, 'autoSelectQueryTextOnOpen', next)}
        />
        <ToggleRow
          label="划词翻译未选中文本时，保留上次结果"
          checked={current.keepResultForSelection}
          onChange={(next) => updateSettings(current, onChange, 'keepResultForSelection', next)}
        />
      </Section>
    </>
  );
}

function renderServiceTab(current: SettingsState, onChange: SettingsUpdater) {
  return (
    <>
      <Section title="自动查询" description="控制划词、截图和粘贴后的自动化动作，减少重复点击。">
        <ToggleRow
          label="划词后自动查询"
          checked={current.autoQueryOnSelection}
          onChange={(next) => updateSettings(current, onChange, 'autoQueryOnSelection', next)}
        />
        <ToggleRow
          label="图片 OCR 后自动查询"
          checked={current.autoQueryOnOcr}
          onChange={(next) => updateSettings(current, onChange, 'autoQueryOnOcr', next)}
        />
        <SelectRow
          label="OCR 结果面板位置"
          value={current.ocrPanelPosition}
          options={OCR_PANEL_POSITION_OPTIONS}
          onChange={(next) => updateSettings(current, onChange, 'ocrPanelPosition', next)}
        />
        <ToggleRow
          label="粘贴后自动查询"
          checked={current.autoQueryOnPaste}
          onChange={(next) => updateSettings(current, onChange, 'autoQueryOnPaste', next)}
        />
        <ToggleRow
          label="查询英语单词后自动播放发音"
          checked={current.autoSpeakEnglishWord}
          onChange={(next) => updateSettings(current, onChange, 'autoSpeakEnglishWord', next)}
        />
        <SelectRow
          label="英语发音"
          value={current.englishVoice}
          options={VOICE_OPTIONS}
          onChange={(next) => updateSettings(current, onChange, 'englishVoice', next)}
        />
      </Section>

      <Section title="服务能力" description="定义结果输出和本地接口暴露方式，决定外部集成行为。">
        <ToggleRow
          label="翻译成功后自动复制结果"
          checked={current.autoCopyResult}
          onChange={(next) => updateSettings(current, onChange, 'autoCopyResult', next)}
        />
        <ToggleRow
          label="启用本地 HTTP API"
          checked={current.httpApiEnabled}
          onChange={(next) => updateSettings(current, onChange, 'httpApiEnabled', next)}
        />
      </Section>
    </>
  );
}

export function renderTabContent(
  tab: SettingsTabId,
  current: SettingsState,
  onChange: SettingsUpdater,
) {
  if (tab === 'tool') {
    return (
      <ProviderPanel
        providers={current.providers}
        onChangeProvider={(key, patch) => updateProviderSetting(current, onChange, key, patch)}
      />
    );
  }
  if (tab === 'general') {
    return renderGeneralTab(current, onChange);
  }
  if (tab === 'service') {
    return renderServiceTab(current, onChange);
  }
  if (tab === 'shortcut') {
    return (
      <ShortcutPanel
        shortcuts={current.shortcuts}
        onChangeShortcut={(key, value) => updateShortcutSetting(current, onChange, key, value)}
      />
    );
  }
  return null;
}
