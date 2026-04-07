import { type CSSProperties, useState } from 'react';
import { ResultState } from './ocrResultWorkbenchModel';
import { CopyHandler } from './ocrResultWorkbenchModel';
import { ProviderGlyph } from './ProviderGlyph';
import {
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconPin,
  TooltipIconButton,
} from './OcrWorkbenchIcons';

type OcrProviderResultsProps = {
  onCopy: CopyHandler;
  onPromoteProvider: (providerId: string) => void;
  resultState: ResultState;
};

function ResultActions(props: {
  canCopy: boolean;
  isPinned: boolean;
  onCopy?: () => void;
  onPromote: () => void;
}) {
  return (
    <div className="ocrMiniActions">
      {props.canCopy && props.onCopy ? (
        <TooltipIconButton ariaLabel="复制" tooltip="复制" size="small" onClick={props.onCopy}>
          <IconCopy />
        </TooltipIconButton>
      ) : null}
      <TooltipIconButton
        ariaLabel={props.isPinned ? '已置顶' : '置顶'}
        tooltip={props.isPinned ? '已置顶' : '置顶到第一位'}
        size="small"
        isActive={props.isPinned}
        onClick={props.onPromote}
      >
        <IconPin />
      </TooltipIconButton>
    </div>
  );
}

export function OcrProviderResults(props: OcrProviderResultsProps) {
  const [expandedProviderIds, setExpandedProviderIds] = useState<string[]>([]);

  function toggleExpanded(providerId: string) {
    setExpandedProviderIds((current) =>
      current.includes(providerId)
        ? current.filter((item) => item !== providerId)
        : [...current, providerId],
    );
  }

  return (
    <section className="ocrSectionCard">
      <header className="ocrSectionHeader">
        <h3>翻译结果</h3>
        <span>{props.resultState.orderedRows.length}</span>
      </header>

      {props.resultState.orderedRows.length > 0 ? (
        <div className="ocrProviderStack">
          {props.resultState.orderedRows.map((item) => {
            const isExpanded = expandedProviderIds.includes(item.providerId);
            const canExpand = item.content.length > 96;
            return (
              <article
                key={item.providerId}
                className={
                  item.isPinned ? 'ocrProviderCard ocrProviderCardPinned' : 'ocrProviderCard'
                }
                data-provider-row={item.providerId}
              >
                <header className="ocrProviderCardHeader">
                  <div className="ocrProviderCardLead">
                    <span
                      className="ocrProviderBadge"
                      data-provider-icon={item.icon}
                      style={{ '--provider-color': item.color } as CSSProperties}
                    >
                      <ProviderGlyph icon={item.icon} />
                    </span>
                    <span className="ocrProviderMeta">
                      <span className="ocrProviderMetaTopline">
                        <span
                          className={
                            item.isPinned
                              ? 'ocrProviderOrder ocrProviderOrderPinned'
                              : 'ocrProviderOrder'
                          }
                        >
                          {item.isPinned ? '置顶' : item.rankLabel}
                        </span>
                        <span className="ocrProviderStatus">{item.statusLabel}</span>
                      </span>
                      <strong>{item.label}</strong>
                    </span>
                  </div>
                  <ResultActions
                    canCopy={item.hasResult && !item.isError}
                    isPinned={item.isPinned}
                    onCopy={
                      item.hasResult && !item.isError
                        ? () => props.onCopy(item.content, `已复制 ${item.label} 结果`)
                        : undefined
                    }
                    onPromote={() => props.onPromoteProvider(item.providerId)}
                  />
                </header>

                <div className="ocrProviderCardBody">
                  <p
                    className={
                      isExpanded ? 'ocrResultText' : 'ocrResultText ocrResultTextCollapsed'
                    }
                  >
                    {item.content}
                  </p>
                  {canExpand ? (
                    <TooltipIconButton
                      ariaLabel={isExpanded ? '收起' : '展开'}
                      tooltip={isExpanded ? '收起' : '展开全文'}
                      size="small"
                      onClick={() => toggleExpanded(item.providerId)}
                    >
                      {isExpanded ? <IconChevronUp /> : <IconChevronDown />}
                    </TooltipIconButton>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="ocrEmptyState">当前没有 Provider 结果。</div>
      )}
    </section>
  );
}
