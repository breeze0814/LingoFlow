import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { TOOL_PROVIDER_DEFINITIONS, ToolProviderConfigMap, ToolProviderId } from './settingsTypes';

type ProviderPatch = {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type ProviderPanelProps = {
  providers: ToolProviderConfigMap;
  onChangeProvider: (providerId: ToolProviderId, patch: ProviderPatch) => void;
};

type ProviderRowProps = {
  active: boolean;
  enabled: boolean;
  id: ToolProviderId;
  logoText: string;
  name: string;
  onSelect: (id: ToolProviderId) => void;
  onToggle: (id: ToolProviderId, enabled: boolean) => void;
};

function ProviderRow(props: ProviderRowProps) {
  const rowClass = props.active ? 'providerRow providerRowActive' : 'providerRow';
  const switchClass = props.enabled
    ? 'switch providerRowSwitch switchOn'
    : 'switch providerRowSwitch switchOff';

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    props.onSelect(props.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={props.active}
      className={rowClass}
      onClick={() => props.onSelect(props.id)}
      onKeyDown={onKeyDown}
    >
      <span className="providerLogo">{props.logoText}</span>
      <span className="providerRowName">{props.name}</span>
      <button
        type="button"
        aria-pressed={props.enabled}
        aria-label={`启用${props.name}`}
        className={switchClass}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle(props.id, !props.enabled);
        }}
      >
        <span className="switchKnob" />
      </button>
    </div>
  );
}

function ProviderSection(props: {
  title: string;
  ids: ToolProviderId[];
  activeProviderId: ToolProviderId;
  providers: ToolProviderConfigMap;
  onSelect: (id: ToolProviderId) => void;
  onToggle: (id: ToolProviderId, enabled: boolean) => void;
}) {
  return (
    <section className="providerGroup">
      <h4>{props.title}</h4>
      <div className="providerGroupList">
        {props.ids.map((id) => {
          const definition = TOOL_PROVIDER_DEFINITIONS.find((item) => item.id === id);
          if (!definition) {
            throw new Error(`unknown provider: ${id}`);
          }
          return (
            <ProviderRow
              key={id}
              id={id}
              logoText={definition.logoText}
              name={definition.name}
              active={props.activeProviderId === id}
              enabled={props.providers[id].enabled}
              onSelect={props.onSelect}
              onToggle={props.onToggle}
            />
          );
        })}
      </div>
    </section>
  );
}

function tokenPlaceholder(providerId: ToolProviderId) {
  if (providerId === 'deepLTranslate') {
    return 'deepl-...';
  }
  return '';
}

function activeProviderOrThrow(providerId: ToolProviderId) {
  const found = TOOL_PROVIDER_DEFINITIONS.find((item) => item.id === providerId);
  if (!found) {
    throw new Error(`unknown provider: ${providerId}`);
  }
  return found;
}

export function ProviderPanel({ providers, onChangeProvider }: ProviderPanelProps) {
  const [activeProviderId, setActiveProviderId] = useState<ToolProviderId>('localOcr');
  const [showApiKey, setShowApiKey] = useState(false);

  const noApiKeyIds = useMemo(
    () =>
      TOOL_PROVIDER_DEFINITIONS.filter((item) => item.group === 'no_api_key').map(
        (item) => item.id,
      ),
    [],
  );
  const requiresApiKeyIds = useMemo(
    () =>
      TOOL_PROVIDER_DEFINITIONS.filter((item) => item.group === 'requires_api_key').map(
        (item) => item.id,
      ),
    [],
  );
  const activeProvider = activeProviderOrThrow(activeProviderId);
  const activeConfig = providers[activeProviderId];

  useEffect(() => {
    setShowApiKey(false);
  }, [activeProviderId]);

  return (
    <section className="providerStudio">
      <aside className="providerListPanel">
        <ProviderSection
          title="无需 API Key"
          ids={noApiKeyIds}
          activeProviderId={activeProviderId}
          providers={providers}
          onSelect={setActiveProviderId}
          onToggle={(id, enabled) => onChangeProvider(id, { enabled })}
        />
        <ProviderSection
          title="需要 API Key"
          ids={requiresApiKeyIds}
          activeProviderId={activeProviderId}
          providers={providers}
          onSelect={setActiveProviderId}
          onToggle={(id, enabled) => onChangeProvider(id, { enabled })}
        />
      </aside>

      <section className="providerEditorPanel" aria-live="polite">
        <h3>{activeProvider.name}</h3>
        <div className="providerEditorBody">
          <label className="providerEditorSwitchRow">
            <span>启用该工具</span>
            <button
              type="button"
              aria-pressed={activeConfig.enabled}
              className={activeConfig.enabled ? 'switch switchOn' : 'switch switchOff'}
              onClick={() =>
                onChangeProvider(activeProviderId, {
                  enabled: !activeConfig.enabled,
                })
              }
            >
              <span className="switchKnob" />
            </button>
          </label>

          {activeProvider.requiresApiKey ? (
            <>
              <label className="providerTokenField">
                <span>Token</span>
                <div className="providerTokenInputWrap">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={activeConfig.apiKey}
                    placeholder={tokenPlaceholder(activeProviderId)}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) =>
                      onChangeProvider(activeProviderId, { apiKey: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="providerEyeButton"
                    aria-label={showApiKey ? '隐藏 Token' : '显示 Token'}
                    onClick={() => setShowApiKey((prev) => !prev)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5c5.5 0 9.4 3.6 11 7-1.6 3.4-5.5 7-11 7S2.6 15.4 1 12c1.6-3.4 5.5-7 11-7Zm0 2C8.2 7 5.2 9.3 3.4 12 5.2 14.7 8.2 17 12 17s6.8-2.3 8.6-5C18.8 9.3 15.8 7 12 7Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
                    </svg>
                  </button>
                </div>
              </label>

              <label className="providerTokenField">
                <span>Base URL</span>
                <input
                  type="text"
                  value={activeConfig.baseUrl}
                  placeholder="https://api-free.deepl.com/v2"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) =>
                    onChangeProvider(activeProviderId, { baseUrl: event.target.value })
                  }
                />
              </label>

              <div className="providerEditorActions">
                <button type="button" className="providerVerifyButton" disabled>
                  验证
                </button>
              </div>
            </>
          ) : (
            <section className="providerEditorHint">
              <p>当前工具走系统本地能力，不需要配置 API Key。</p>
            </section>
          )}
        </div>
      </section>
    </section>
  );
}
