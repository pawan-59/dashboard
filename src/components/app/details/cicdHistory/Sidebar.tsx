import React, { useEffect, useRef } from 'react'
import { useRouteMatch, useParams, useHistory, generatePath, useLocation } from 'react-router'
import ReactSelect, { components } from 'react-select'
import moment from 'moment'
import TippyHeadless from '@tippyjs/react/headless'
import { NavLink } from 'react-router-dom'
import ReactGA from 'react-ga4'
import { ConditionalWrap, createGitCommitUrl } from '../../../common'
import { DropdownIndicator, getCustomOptionSelectionStyle } from '../../../v2/common/ReactSelect.utils'
import { Moment12HourFormat, SourceTypeMap } from '../../../../config'
import { CiPipelineSourceConfig } from '../../../ciPipeline/CiPipelineSourceConfig'
import {
    CICDSidebarFilterOptionType,
    GitTriggers,
    HistoryComponentType,
    HistorySummaryCardType,
    SidebarType,
    SummaryTooltipCardType,
    FetchIdDataStatus,
} from './types'
import { statusColor as colorMap } from '../../config'
import { ReactComponent as Docker } from '../../../../assets/icons/misc/docker.svg'
import { ReactComponent as ICArrowBackward } from '../../../../assets/icons/ic-arrow-backward.svg'
import DetectBottom from '../../../common/DetectBottom'
import { FILTER_STYLE, HISTORY_LABEL } from './Constants'
import { triggerStatus } from './History.components'

const Sidebar = React.memo(
    ({
        type,
        filterOptions,
        triggerHistory,
        hasMore,
        setPagination,
        fetchIdData,
        handleViewAllHistory,
    }: SidebarType) => {
        const { pipelineId, appId, envId } = useParams<{ appId: string; envId: string; pipelineId: string }>()
        const { push } = useHistory()
        const { path } = useRouteMatch()

        const handleFilterChange = (selectedFilter: CICDSidebarFilterOptionType): void => {
            if (type === HistoryComponentType.CI) {
                setPagination({ offset: 0, size: 20 })
                push(generatePath(path, { appId, pipelineId: selectedFilter.value }))
            } else if (type === HistoryComponentType.GROUP_CI) {
                setPagination({ offset: 0, size: 20 })
                push(generatePath(path, { envId, pipelineId: selectedFilter.pipelineId }))
            } else if (type === HistoryComponentType.GROUP_CD) {
                setPagination({ offset: 0, size: 20 })
                push(generatePath(path, { envId, appId: selectedFilter.value, pipelineId: selectedFilter.pipelineId }))
            } else {
                setPagination({ offset: 0, size: 20 })
                push(generatePath(path, { appId, envId: selectedFilter.value, pipelineId: selectedFilter.pipelineId }))
            }
        }
        function reloadNextAfterBottom() {
            ReactGA.event({
                category: 'pagination',
                action: 'scroll',
                label: `${type.toLowerCase()}-history`,
                value: triggerHistory.size,
            })
            setPagination({ offset: triggerHistory.size, size: 20 })
        }

        const filterOptionType = () => {
            if (type === HistoryComponentType.CI || type === HistoryComponentType.GROUP_CI) {
                return pipelineId
            }
            if (type === HistoryComponentType.GROUP_CD) {
                return appId
            }
            return envId
        }

        const selectedFilter = filterOptions?.find((filterOption) => filterOption.value === filterOptionType()) ?? null
        filterOptions?.sort((a, b) => (a.label > b.label ? 1 : -1))
        const _filterOptions = filterOptions?.filter((filterOption) => !filterOption.deploymentAppDeleteRequest)

        const selectLabel = () => {
            if (type === HistoryComponentType.GROUP_CI || type === HistoryComponentType.GROUP_CD) {
                return HISTORY_LABEL.APPLICATION
            }
            if (type === HistoryComponentType.CI) {
                return HISTORY_LABEL.PIPELINE
            }
            return HISTORY_LABEL.ENVIRONMENT
        }

        const ciPipelineBuildTypeOption = (props): JSX.Element => {
            props.selectProps.styles.option = getCustomOptionSelectionStyle()
            return (
                <components.Option {...props}>
                    <div style={{ display: 'flex' }}>
                        {(type === HistoryComponentType.CI || type === HistoryComponentType.GROUP_CI) && (
                            <div
                                className={
                                    `dc__ci-pipeline-type-icon mr-5 ${props.data.pipelineType?.toLowerCase()}` || ''
                                }
                            />
                        )}
                        {props.label}
                    </div>
                </components.Option>
            )
        }

        return (
            <>
                <div
                    className="select-pipeline-wrapper w-100 pl-16 pr-16 dc__overflow-hidden"
                    style={{
                        borderBottom: '1px solid var(--n-100, #EDF1F5)',
                    }}
                >
                    <label className="form__label" data-testid="select-history-heading">
                        Select {selectLabel()}
                    </label>
                    <ReactSelect
                        classNamePrefix="history-pipeline-dropdown"
                        value={selectedFilter}
                        options={
                            type === HistoryComponentType.CI || type === HistoryComponentType.GROUP_CI
                                ? filterOptions
                                : _filterOptions
                        }
                        onChange={handleFilterChange}
                        components={{
                            IndicatorSeparator: null,
                            Option: ciPipelineBuildTypeOption,
                            DropdownIndicator,
                        }}
                        styles={FILTER_STYLE}
                        menuPosition="fixed"
                    />
                </div>

                <div className="flex column top left" style={{ overflowY: 'auto' }}>
                    {fetchIdData === FetchIdDataStatus.SUCCESS && (
                        <ViewAllCardsTile handleViewAllHistory={handleViewAllHistory} />
                    )}

                    {Array.from(triggerHistory)
                        .sort(([a], [b]) => b - a)
                        .map(([triggerId, triggerDetails], index) => (
                            <HistorySummaryCard
                                dataTestId={`deployment-history-${index}`}
                                key={triggerId}
                                id={triggerId}
                                status={triggerDetails.status}
                                startedOn={triggerDetails.startedOn}
                                triggeredBy={triggerDetails.triggeredBy}
                                triggeredByEmail={triggerDetails.triggeredByEmail}
                                ciMaterials={triggerDetails.ciMaterials}
                                gitTriggers={triggerDetails.gitTriggers}
                                artifact={triggerDetails.artifact}
                                stage={triggerDetails.stage}
                                type={type}
                            />
                        ))}
                    {hasMore && (fetchIdData === FetchIdDataStatus.SUSPEND || !fetchIdData) && (
                        <DetectBottom callback={reloadNextAfterBottom} />
                    )}
                </div>
            </>
        )
    },
)

export default Sidebar

const HistorySummaryCard = React.memo(
    ({
        id,
        status,
        startedOn,
        triggeredBy,
        triggeredByEmail,
        ciMaterials,
        gitTriggers,
        artifact,
        type,
        stage,
        dataTestId,
    }: HistorySummaryCardType): JSX.Element => {
        const { path, params } = useRouteMatch()
        const { pathname } = useLocation()
        const currentTab = pathname.split('/').pop()
        const { triggerId, envId, ...rest } = useParams<{ triggerId: string; envId: string }>()
        const isCDType: boolean = type === HistoryComponentType.CD || type === HistoryComponentType.GROUP_CD
        const idName = isCDType ? 'triggerId' : 'buildId'

        const targetCardRef = useRef(null)

        const getPath = (): string => {
            const _params = {
                ...rest,
                envId,
                [idName]: id,
            }
            return `${generatePath(path, _params)}/${currentTab}`
        }

        useEffect(() => {
            scrollToElement()
        }, [targetCardRef])

        const activeID = params[idName]
        const scrollToElement = () => {
            if (targetCardRef?.current) {
                targetCardRef.current.scrollIntoView({ behavior: 'smooth' })
            }
        }

        const assignTargetCardRef = (el) => {
            if (+activeID === +id) {
                targetCardRef.current = el
            }
        }
        return (
            <ConditionalWrap
                condition={Array.isArray(ciMaterials)}
                wrap={(children) => (
                    <TippyHeadless
                        placement="right"
                        interactive
                        render={() => (
                            <SummaryTooltipCard
                                status={status}
                                startedOn={startedOn}
                                triggeredBy={triggeredBy}
                                triggeredByEmail={triggeredByEmail}
                                ciMaterials={ciMaterials}
                                gitTriggers={gitTriggers}
                            />
                        )}
                    >
                        {children}
                    </TippyHeadless>
                )}
            >
                <NavLink
                    to={getPath}
                    className="w-100 ci-details__build-card-container"
                    data-testid={dataTestId}
                    activeClassName="active"
                    ref={assignTargetCardRef}
                >
                    <div className="w-100 ci-details__build-card">
                        <div
                            className={`dc__app-summary__icon icon-dim-20 ${triggerStatus(status)
                                ?.toLocaleLowerCase()
                                .replace(/\s+/g, '')}`}
                        />
                        <div className="flex column left dc__ellipsis-right">
                            <div className="cn-9 fs-14">{moment(startedOn).format(Moment12HourFormat)}</div>
                            <div className="flex left cn-7 fs-12">
                                {isCDType && (
                                    <>
                                        <div className="dc__capitalize">
                                            {['pre', 'post'].includes(stage?.toLowerCase()) ? `${stage}-deploy` : stage}
                                        </div>
                                        <span className="dc__bullet dc__bullet--d2 ml-4 mr-4" />

                                        {artifact && (
                                            <div className="dc__app-commit__hash dc__app-commit__hash--no-bg">
                                                <Docker className="commit-hash__icon grayscale" />
                                                {artifact.split(':')[1].slice(-12)}
                                            </div>
                                        )}
                                        <span className="dc__bullet dc__bullet--d2 ml-4 mr-4" />
                                    </>
                                )}
                                <div className="cn-7 fs-12">
                                    {triggeredBy === 1 ? 'auto trigger' : triggeredByEmail}
                                </div>
                            </div>
                        </div>
                    </div>
                </NavLink>
            </ConditionalWrap>
        )
    },
)

const SummaryTooltipCard = React.memo(
    ({
        status,
        startedOn,
        triggeredBy,
        triggeredByEmail,
        ciMaterials,
        gitTriggers,
    }: SummaryTooltipCardType): JSX.Element => {
        return (
            <div className="build-card-popup p-16 br-4 w-400 bcn-0 mxh-300 dc__overflow-scroll">
                <span className="fw-6 fs-16 mb-4" style={{ color: colorMap[status.toLowerCase()] }}>
                    {status.toLowerCase() === 'cancelled' ? 'Aborted' : status}
                </span>
                <div className="flex column left">
                    <div className="flex left fs-12 cn-7">
                        <div>{moment(startedOn).format(Moment12HourFormat)}</div>
                        <div className="dc__bullet ml-6 mr-6" />
                        <div>{triggeredBy === 1 ? 'auto trigger' : triggeredByEmail}</div>
                    </div>
                    {Object.keys(gitTriggers ?? {}).length > 0 &&
                        ciMaterials?.map((ciMaterial) => {
                            const gitDetail: GitTriggers = gitTriggers[ciMaterial.id]
                            const sourceType = gitDetail?.CiConfigureSourceType
                                ? gitDetail.CiConfigureSourceType
                                : ciMaterial?.type
                            const sourceValue = gitDetail?.CiConfigureSourceValue
                                ? gitDetail.CiConfigureSourceValue
                                : ciMaterial?.value
                            const gitMaterialUrl = gitDetail?.GitRepoUrl ? gitDetail.GitRepoUrl : ciMaterial?.url
                            if (sourceType !== SourceTypeMap.WEBHOOK && !gitDetail) {
                                return null
                            }
                            return (
                                <div className="mt-22 ci-material-detail" key={ciMaterial.id}>
                                    {sourceType == SourceTypeMap.WEBHOOK ? (
                                        <div className="flex left column">
                                            <CiPipelineSourceConfig
                                                sourceType={sourceType}
                                                sourceValue={sourceValue}
                                                showTooltip={false}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="dc__git-logo"> </div>
                                            <div className="flex left column">
                                                <a
                                                    href={createGitCommitUrl(gitMaterialUrl, gitDetail.Commit)}
                                                    target="_blank"
                                                    rel="noopener noreferer noreferrer"
                                                    className="fs-12 fw-6 cn-9 pointer"
                                                >
                                                    /{sourceValue}
                                                </a>
                                                <p className="fs-12 cn-7">{gitDetail?.Message}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                </div>
            </div>
        )
    },
)

const ViewAllCardsTile = React.memo(({ handleViewAllHistory }: { handleViewAllHistory: () => void }): JSX.Element => {
    return (
        <div className="flex pt-12 pb-12 pl-16 pr-16 dc__gap-16 dc__align-self-stretch">
            <button className="p-0 dc__no-background dc__no-border h-16" onClick={handleViewAllHistory}>
                <ICArrowBackward width={16} height={16} />
            </button>

            <div style={{ flex: '1 0 0' }}>
                <p className="ci-cd-details__sidebar-typography">View all items in history</p>
            </div>
        </div>
    )
})
