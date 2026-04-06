import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import {
  TOOL_PROVIDER_DEFINITIONS,
  ToolProviderConfig,
  ToolProviderConfigMap,
  ToolProviderDefinition,
  ToolProviderFieldDefinition,
  ToolProviderId,
} from './settingsTypes';
import { ProviderGlyph } from '../ocr/ProviderGlyph';

type ProviderPatch = Partial<ToolProviderConfig>;

const PROVIDER_ICON_MAP: Record<ToolProviderId, string> = {
  localOcr: 'ocr',
  youdao_web: 'youdao',
  bing_web: 'bing',
  deepl_free: 'deepl',
  azure_translator: 'azure',
  google_translate: 'google',
  tencent_tmt: 'tencent',
  baidu_fanyi: 'baidu',
};

type ProviderPanelProps = {
  providers: ToolProviderConfigMap;
  onChangeProvider: (providerId: ToolProviderId, patch: ProviderPatch) => void;
};

type ProviderRowProps = {
  active: boolean;
  category: ToolProviderDefinition['category'];
  enabled: boolean;
  icon: string;
  id: ToolProviderId;
  name: string;
  onSelect: (id: ToolProviderId) => void;
  onToggle: (id: ToolProviderId, enabled: boolean) => void;
};

function providerRowMeta(category: ToolProviderDefinition['category'], enabled: boolean) {
  return `${category} · ${enabled ? '已启用' : '未启用'}`;
}

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
      aria-label={props.name}
      aria-pressed={props.active}
      className={rowClass}
      data-provider={props.id}
      onClick={() => props.onSelect(props.id)}
      onKeyDown={onKeyDown}
    >
      <span className="providerRowLead">
        <span className="providerRowIconShell" aria-hidden="true">
          <span className="providerRowIcon">
            <ProviderGlyph icon={props.icon} />
          </span>
        </span>
        <span className="providerRowText">
          <span className="providerRowName">{props.name}</span>
          <span className="providerRowMeta">
            {providerRowMeta(props.category, props.enabled)}
          </span>
        </span>
      </span>
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
              name={definition.name}
              category={definition.category}
              icon={PROVIDER_ICON_MAP[id]}
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

function activeProviderOrThrow(providerId: ToolProviderId) {
  const found = TOOL_PROVIDER_DEFINITIONS.find((item) => item.id === providerId);
  if (!found) {
    throw new Error(`unknown provider: ${providerId}`);
  }
  return found;
}

function fieldValue(config: ToolProviderConfig, field: ToolProviderFieldDefinition): string {
  return config[field.key];
}

export function ProviderPanel({ providers, onChangeProvider }: ProviderPanelProps) {
  const [activeProviderId, setActiveProviderId] = useState<ToolProviderId>('localOcr');
  const [showSecrets, setShowSecrets] = useState(false);

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
    setShowSecrets(false);
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
        <header className="providerEditorHeader">
          <div>
            <h3>{activeProvider.name}</h3>
            <p className="providerEditorDescription">{activeProvider.description}</p>
          </div>
        </header>

        <div className="providerEditorBody">
          <label className="providerEditorSwitchRow">
            <span>启用该工具</span>
            <button
              type="button"
              aria-pressed={activeConfig.enabled}
              className={activeConfig.enabled ? 'switch switchOn' : 'switch switchOff'}
              onClick={() => onChangeProvider(activeProviderId, { enabled: !activeConfig.enabled })}
            >
              <span className="switchKnob" />
            </button>
          </label>

          {activeProvider.fields.length > 0 ? (
            <>
              {activeProvider.fields.some((field) => field.secret) ? (
                <button
                  type="button"
                  className="providerSecretToggle"
                  onClick={() => setShowSecrets((prev) => !prev)}
                >
                  {showSecrets ? '隐藏敏感字段' : '显示敏感字段'}
                </button>
              ) : null}

              {activeProvider.fields.map((field) => {
                const input = (
                  <input
                    type={field.secret && !showSecrets ? 'password' : 'text'}
                    value={fieldValue(activeConfig, field)}
                    placeholder={field.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) =>
                      onChangeProvider(activeProviderId, { [field.key]: event.target.value })
                    }
                  />
                );
                return (
                  <label key={field.key} className="providerTokenField">
                    <span>{field.label}</span>
                    {field.secret ? <div className="providerTokenInputWrap">{input}</div> : input}
                  </label>
                );
              })}
            </>
          ) : (
            <section className="providerEditorHint">
              <p>{activeProvider.helpText ?? '当前工具不需要额外配置。'}</p>
            </section>
          )}

          {activeProvider.links.length > 0 ? (
            <section className="providerLinks">
              <h4>获取配置</h4>
              <div className="providerLinkList">
                {activeProvider.links.map((link) => (
                  <a
                    key={link.url}
                    className="providerDocLink"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </section>
  );
}
