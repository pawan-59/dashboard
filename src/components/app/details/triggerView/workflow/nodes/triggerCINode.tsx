import React, { Component } from 'react'
import { RouteComponentProps } from 'react-router'
import { Link } from 'react-router-dom'
import Tippy from '@tippyjs/react'
import { TriggerStatus } from '../../../../config'
import { CIMaterialType } from '../../MaterialHistory'
import { BUILD_STATUS, DEFAULT_STATUS, URLS } from '../../../../../../config'
import link from '../../../../../../assets/icons/ic-link.svg'
import { TriggerViewContext } from '../../config'
import { DEFAULT_ENV } from '../../Constants'

export interface TriggerCINodeProps extends RouteComponentProps<{ appId: string }> {
    x: number
    y: number
    height: number
    width: number
    id: string
    title: string
    type: string
    triggerType: string
    isExternalCI: boolean
    isLinkedCI: boolean
    isJobCI: boolean
    description: string
    status: string
    linkedCount: number
    downstreams?: string[]
    colorCode: string
    inputMaterialsNew: CIMaterialType[]
    workflowId: string
    branch: string
    fromAppGrouping: boolean
    isJobView?: boolean
    index?: number
    isCITriggerBlocked?: boolean
    ciBlockState?: {
        action: any
        metadataField: string
    }
    filteredCIPipelines?: any[]
    environmentLists?: any[]
}

export class TriggerCINode extends Component<TriggerCINodeProps> {
    constructor(props) {
        super(props)
        this.redirectToCIDetails = this.redirectToCIDetails.bind(this)
    }

    getCIDetailsURL(): string {
        return `${this.props.match.url.replace(URLS.APP_TRIGGER, URLS.APP_CI_DETAILS)}/${this.props.id}`
    }

    redirectToCIDetails() {
        if (this.props.fromAppGrouping) {
            return
        }
        this.props.history.push(this.getCIDetailsURL())
    }

    hideDetails(status: string = '') {
        return (
            status === DEFAULT_STATUS.toLowerCase() ||
            status === BUILD_STATUS.NOT_TRIGGERED ||
            status === BUILD_STATUS.NOT_DEPLOYED ||
            status === ''
        )
    }

    renderStatus() {
        const url = this.getCIDetailsURL()
        const status = this.props.status ? this.props.status.toLowerCase() : ''
        if (this.hideDetails(status)) {
            return (
                <div
                    data-testid={`ci-trigger-status-${this.props.index}`}
                    className="dc__cd-trigger-status mb-6"
                    style={{ color: TriggerStatus[status] }}
                >
                    {this.props.status ? this.props.status : BUILD_STATUS.NOT_TRIGGERED}
                </div>
            )
        }
        return (
            <div
                data-testid={`ci-trigger-status-${this.props.index}`}
                className="dc__cd-trigger-status mb-6"
                style={{ color: TriggerStatus[status] }}
            >
                {this.props.status && this.props.status.toLowerCase() === 'cancelled' ? 'ABORTED' : this.props.status}
                {this.props.status && <span className="mr-5 ml-5">/</span>}
                <Link
                    data-testid={`ci-trigger-select-details-button-${this.props.title}`}
                    to={url}
                    className="workflow-node__details-link"
                >
                    Details
                </Link>
            </div>
        )
    }

    renderCardContent(context) {
        const hideDetails = this.hideDetails(this.props.status?.toLowerCase())
        let _selectedEnv
        if (this.props.isJobView) {
            const _selectedPipeline = this.props.filteredCIPipelines?.find(
                (_ciPipeline) => _ciPipeline?.id == this.props.id,
            )
            let envId = _selectedPipeline?.environmentId
            if (!_selectedPipeline?.environmentId && _selectedPipeline?.lastTriggeredEnvId === -1) {
                envId = 0
            } else if (_selectedPipeline?.lastTriggeredEnvId !== -1) {
                envId = _selectedPipeline?.lastTriggeredEnvId
            }
            _selectedEnv = this.props.environmentLists.find((env) => env.id == envId)
        }
        return (
            <div
                className={`${hideDetails ? 'workflow-node' : 'workflow-node cursor'}`}
                onClick={(e) => {
                    if (!hideDetails) {
                        this.redirectToCIDetails()
                    }
                }}
            >
                {this.props.linkedCount ? (
                    <Tippy className="default-tt" arrow placement="bottom" content={this.props.linkedCount}>
                        <span className="link-count">
                            <img src={link} className="icon-dim-12 mr-5" alt="" />
                            {this.props.linkedCount}
                        </span>
                    </Tippy>
                ) : null}
                <div
                    className={`workflow-node__trigger-type workflow-node__trigger-type--ci ${
                        this.props.isCITriggerBlocked ? 'flex bcr-1 er-2 bw-1 cr-5' : ''
                    }`}
                    style={{
                        opacity: this.props.isCITriggerBlocked ? 1 : 0.4,
                    }}
                >
                    {this.props.isCITriggerBlocked ? 'BLOCKED' : this.props.triggerType}
                </div>
                <div className="workflow-node__title flex">
                    {/* <img src={build} className="icon-dim-24 mr-16" /> */}
                    <div className="workflow-node__full-width-minus-Icon">
                        {!this.props.isJobView && (
                            <span className="workflow-node__text-light"> {this.props.isJobCI ? 'Job' : 'Build'} </span>
                        )}
                        <Tippy className="default-tt" arrow placement="bottom" content={this.props.title}>
                            <div className="dc__ellipsis-left">{this.props.title}</div>
                        </Tippy>
                        {this.props.isJobView && _selectedEnv && (
                            <>
                                <span className="fw-4 fs-11">Env: {_selectedEnv.name}</span>
                                {_selectedEnv.name === DEFAULT_ENV && (
                                    <span className="fw-4 fs-11 ml-4 dc__italic-font-style">(Default)</span>
                                )}
                            </>
                        )}
                    </div>
                    <div
                        className={`workflow-node__icon-common ml-8 ${
                            this.props.isJobView || this.props.isJobCI
                                ? 'workflow-node__job-icon'
                                : 'workflow-node__CI-icon'
                        }`}
                    />
                </div>
                {this.renderStatus()}
                <div className="workflow-node__btn-grp">
                    <button
                        data-testid={`workflow-build-select-material-button-${this.props.index}`}
                        className="workflow-node__deploy-btn workflow-node__deploy-btn--ci"
                        onClick={(event) => {
                            event.stopPropagation()
                            context.onClickCIMaterial(this.props.id, this.props.title)
                        }}
                    >
                        Select Material
                    </button>
                </div>
            </div>
        )
    }

    render() {
        return (
            <foreignObject
                className="data-hj-whitelist"
                x={this.props.x}
                y={this.props.y}
                width={this.props.width}
                height={this.props.height}
                style={{ overflow: 'visible' }}
            >
                <TriggerViewContext.Consumer>
                    {(context) => {
                        return this.renderCardContent(context)
                    }}
                </TriggerViewContext.Consumer>
            </foreignObject>
        )
    }
}
