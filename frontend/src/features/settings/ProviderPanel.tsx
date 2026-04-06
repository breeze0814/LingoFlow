import { KeyboardEvent, useEffect, useState } from 'react';
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

const LOCAL_OCR_ID: ToolProviderId = 'localOcr';
const API_PROVIDER_IDS = TOOL_PROVIDER_DEFINITIONS.filter((item) => item.id !== LOCAL_OCR_ID).map(
  (item) => item.id,
);

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
  definition: ToolProviderDefinition;
  enabled: boolean;
  showMeta?: boolean;
  onSelect: (id: ToolProviderId) => void;
  onToggle: (id: ToolProviderId, enabled: boolean) => void;
};

type ProviderDetailProps = {
  config: ToolProviderConfig;
  provider: ToolProviderDefinition;
  showSecrets: boolean;
  onChangeProvider: (patch: ProviderPatch) => void;
  onToggleSecrets: () => void;
};

function providerDefinitionOrThrow(providerId: ToolProviderId) {
  const found = TOOL_PROVIDER_DEFINITIONS.find((item) => item.id === providerId);
  if (!found) {
    throw new Error(`unknown provider: ${providerId}`);
  }
  return found;
}

function providerRowMeta(definition: ToolProviderDefinition, enabled: boolean) {
  return `${definition.category} · ${enabled ? '已启用' : '未启用'}`;
}

function fieldValue(config: ToolProviderConfig, field: ToolProviderFieldDefinition): string {
  return config[field.key];
}

function ProviderRow(props: ProviderRowProps) {
  const className = props.active ? 'providerRow providerRowActive' : 'providerRow';
  const switchClass = props.enabled
    ? 'switch providerRowSwitch switchOn'
    : 'switch providerRowSwitch switchOff';

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    props.onSelect(props.definition.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={props.definition.name}
      aria-pressed={props.active}
      className={className}
      data-provider={props.definition.id}
      onClick={() => props.onSelect(props.definition.id)}
      onKeyDown={onKeyDown}
    >
      <span className="providerRowLead">
        <span className="providerRowIconShell" aria-hidden="true">
          <span className="providerRowIcon">
            <ProviderGlyph icon={PROVIDER_ICON_MAP[props.definition.id]} />
          </span>
        </span>
        <span className="providerRowText">
          <span className="providerRowName">{props.definition.name}</span>
          {props.showMeta ? (
            <span className="providerRowMeta">
              {providerRowMeta(props.definition, props.enabled)}
            </span>
          ) : null}
        </span>
      </span>
      <button
        type="button"
        aria-pressed={props.enabled}
        aria-label={`启用${props.definition.name}`}
        className={switchClass}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle(props.definition.id, !props.enabled);
        }}
      >
        <span className="switchKnob" />
      </button>
    </div>
  );
}

function ProviderFields(props: ProviderDetailProps) {
  return (
    <>
      {props.provider.fields.some((field) => field.secret) ? (
        <button type="button" className="providerSecretToggle" onClick={props.onToggleSecrets}>
          {props.showSecrets ? '隐藏敏感字段' : '显示敏感字段'}
        </button>
      ) : null}

      {props.provider.fields.map((field) => {
        const input = (
          <input
            type={field.secret && !props.showSecrets ? 'password' : 'text'}
            value={fieldValue(props.config, field)}
            placeholder={field.placeholder}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => props.onChangeProvider({ [field.key]: event.target.value })}
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
  );
}

function ProviderLinks(props: { links: ToolProviderDefinition['links'] }) {
  if (props.links.length === 0) {
    return null;
  }

  return (
    <section className="providerLinks">
      <h4>获取配置</h4>
      <div className="providerLinkList">
        {props.links.map((link) => (
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
  );
}

function ProviderDetail(props: ProviderDetailProps) {
  return (
    <section className="providerSectionDetail">
      <header className="providerEditorHeader">
        <div>
          <h3>{props.provider.name}</h3>
          <p className="providerEditorDescription">{props.provider.description}</p>
        </div>
      </header>

      <div className="providerEditorBody">
        <label className="providerEditorSwitchRow">
          <span>启用该工具</span>
          <button
            type="button"
            aria-pressed={props.config.enabled}
            className={props.config.enabled ? 'switch switchOn' : 'switch switchOff'}
            onClick={() => props.onChangeProvider({ enabled: !props.config.enabled })}
          >
            <span className="switchKnob" />
          </button>
        </label>

        {props.provider.fields.length > 0 ? (
          <ProviderFields {...props} />
        ) : (
          <section className="providerEditorHint">
            <p>{props.provider.helpText ?? '当前工具不需要额外配置。'}</p>
          </section>
        )}

        <ProviderLinks links={props.provider.links} />
      </div>
    </section>
  );
}

function ProviderListPanel(props: {
  activeProviderId: ToolProviderId;
  onChangeProvider: (providerId: ToolProviderId, patch: ProviderPatch) => void;
  onSelectProvider: (providerId: ToolProviderId) => void;
  providers: ToolProviderConfigMap;
}) {
  return (
    <aside className="providerListPanel">
      <header className="providerSectionHeader">
        <h4>API Provider</h4>
      </header>
      <div className="providerSectionList">
        {API_PROVIDER_IDS.map((providerId) => {
          const definition = providerDefinitionOrThrow(providerId);
          return (
            <ProviderRow
              key={providerId}
              active={props.activeProviderId === providerId}
              definition={definition}
              enabled={props.providers[providerId].enabled}
              showMeta={false}
              onSelect={props.onSelectProvider}
              onToggle={(id, enabled) => props.onChangeProvider(id, { enabled })}
            />
          );
        })}
      </div>
    </aside>
  );
}

export function ProviderPanel({ providers, onChangeProvider }: ProviderPanelProps) {
  const [activeProviderId, setActiveProviderId] = useState<ToolProviderId>(API_PROVIDER_IDS[0]);
  const [showSecrets, setShowSecrets] = useState(false);
  const activeProvider = providerDefinitionOrThrow(activeProviderId);
  const activeConfig = providers[activeProviderId];

  useEffect(() => {
    setShowSecrets(false);
  }, [activeProviderId]);

  return (
    <section className="providerStudio">
      <ProviderListPanel
        activeProviderId={activeProviderId}
        onChangeProvider={onChangeProvider}
        onSelectProvider={setActiveProviderId}
        providers={providers}
      />
      <section className="providerEditorPanel" aria-live="polite">
        <ProviderDetail
          config={activeConfig}
          provider={activeProvider}
          showSecrets={showSecrets}
          onChangeProvider={(patch) => onChangeProvider(activeProvider.id, patch)}
          onToggleSecrets={() => setShowSecrets((prev) => !prev)}
        />
      </section>
    </section>
  );
}
