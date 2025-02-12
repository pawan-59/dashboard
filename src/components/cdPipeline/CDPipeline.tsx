import React, { Component } from 'react'
import { toast } from 'react-toastify'
import {
    ErrorScreenManager,
    Progressing,
    showError,
    VisibleModal,
    Drawer,
    DeleteDialog,
    ForceDeleteDialog,
    ServerErrors,
    Checkbox,
    CHECKBOX_VALUE,
    InfoColourBar,
    RadioGroup,
    RadioGroupItem,
    TippyCustomized,
    TippyTheme,
    sortCallback,
    DeploymentAppTypes,
    PipelineType,
    CustomInput,
} from '@devtron-labs/devtron-fe-common-lib'
import yamlJsParser from 'yaml'
import ReactSelect from 'react-select'
import Tippy from '@tippyjs/react'
import { DELETE_ACTION, SourceTypeMap, TriggerType, ViewType } from '../../config'
import {
    Select,
    ButtonWithLoader,
    isEmpty,
    DevtronSwitch as Switch,
    DevtronSwitchItem as SwitchItem,
    sortObjectArrayAlphabetically,
} from '../common'
import { Info } from '../common/icons/Icons'
import {
    getDeploymentStrategyList,
    saveCDPipeline,
    getCDPipelineConfig,
    updateCDPipeline,
    deleteCDPipeline,
    getCDPipelineNameSuggestion,
    getConfigMapAndSecrets,
} from './cdPipeline.service'
import { CDPipelineProps, CDPipelineState, CD_PATCH_ACTION, Environment, GeneratedHelmPush } from './cdPipeline.types'
import { ValidationRules } from './validationRules'
import { getEnvironmentListMinPublic } from '../../services/service'
import { ReactComponent as Key } from '../../assets/icons/ic-key-bulb.svg'
import { ReactComponent as File } from '../../assets/icons/ic-file-text.svg'
import { ReactComponent as Add } from '../../assets/icons/ic-add.svg'
import { ReactComponent as Close } from '../../assets/icons/ic-close.svg'
import { ReactComponent as PrePostCD } from '../../assets/icons/ic-cd-stage.svg'
import { ReactComponent as CD } from '../../assets/icons/ic-CD.svg'
import { ReactComponent as Help } from '../../assets/icons/ic-help.svg'
import settings from '../../assets/icons/ic-settings.svg'
import trash from '../../assets/icons/misc/delete.svg'
import error from '../../assets/icons/misc/errorInfo.svg'
import CodeEditor from '../CodeEditor/CodeEditor'
import config from './sampleConfig.json'
import { styles, DropdownIndicator, Option } from './cdpipeline.util'
import {
    EnvFormatOptions,
    formatHighlightedTextDescription,
    GroupHeading,
    groupStyle,
} from '../v2/common/ReactSelect.utils'
import './cdPipeline.scss'
import dropdown from '../../assets/icons/ic-chevron-down.svg'
import {
    ConditionalWrap,
    createClusterEnvGroup,
    getDeploymentAppType,
    importComponentFromFELibrary,
} from '../common/helpers/Helpers'
import {
    DEPLOY_IMAGE_EXTERNALSOURCE,
    EDIT_DEPLOYMENT_PIPELINE,
    CREATE_DEPLOYMENT_PIPELINE,
    MULTI_REQUIRED_FIELDS_MSG,
    TOAST_INFO,
    CONFIGMAPS_SECRETS,
} from '../../config/constantMessaging'
import { ReactComponent as Rocket } from '../../assets/icons/ic-paper-rocket.svg'
import { ReactComponent as Question } from '../../assets/icons/ic-help-outline.svg'
import ClusterNotReachableDailog from '../common/ClusterNotReachableDailog/ClusterNotReachableDialog'
import { DeploymentAppRadioGroup } from '../v2/values/chartValuesDiff/ChartValuesView.component'
import { getDockerRegistryMinAuth } from '../ciConfig/service'

const ManualApproval = importComponentFromFELibrary('ManualApproval')
const VirtualEnvSelectionInfoText = importComponentFromFELibrary('VirtualEnvSelectionInfoText')
const HelmManifestPush = importComponentFromFELibrary('HelmManifestPush')

export const SwitchItemValues = {
    Sample: 'sample',
    Config: 'config',
}

export default class CDPipeline extends Component<CDPipelineProps, CDPipelineState> {
    allStrategies: { [key: string]: any } = {}

    isWebhookCD = window.location.href.includes('webhook')

    validationRules

    preStage

    postStage

    configMapAndSecrets = []

    noStrategyAvailable = false

    constructor(props) {
        super(props)
        const urlParams = new URLSearchParams(this.props.location.search)
        const parentPipelineTypeFromURL = urlParams.get('parentPipelineType')
        const parentPipelineType = parentPipelineTypeFromURL
            ? parentPipelineTypeFromURL.toLocaleUpperCase().replace('-', '_')
            : this.isWebhookCD
              ? SourceTypeMap.WEBHOOK
              : ''
        const parentPipelineId = urlParams.get('parentPipelineId')
        this.state = {
            view: ViewType.LOADING,
            loadingData: false,
            code: 0,
            showError: false,
            errorForm: {
                pipelineNameError: { isValid: true, message: '' },
                envNameError: { isValid: true, message: '' },
                nameSpaceError: { isValid: true, message: '' },
                containerRegistryError: { isValid: true, message: '' },
                repositoryError: { isValid: true, message: '' },
            },
            environments: [],
            strategies: [],
            pipelineConfig: {
                id: null,
                environmentId: 0,
                ciPipelineId: this.isWebhookCD ? 0 : +this.props.match.params.ciPipelineId,
                triggerType: TriggerType.Auto,
                name: '',
                strategies: [],
                namespace: '',
                preStage: {
                    config: '',
                    triggerType: TriggerType.Auto,
                    switch: SwitchItemValues.Config,
                },
                postStage: {
                    config: '',
                    triggerType: TriggerType.Auto,
                    switch: SwitchItemValues.Config,
                },
                preStageConfigMapSecretNames: {
                    configMaps: [],
                    secrets: [],
                },
                postStageConfigMapSecretNames: {
                    configMaps: [],
                    secrets: [],
                },
                runPreStageInEnv: false,
                runPostStageInEnv: false,
                isClusterCdActive: false,
                parentPipelineId: +parentPipelineId,
                parentPipelineType,
                deploymentAppType: window._env_.HIDE_GITOPS_OR_HELM_OPTION ? '' : DeploymentAppTypes.HELM,
                deploymentAppCreated: false,
                userApprovalConfig: null,
                isVirtualEnvironment: false,
                repoName: '',
                containerRegistryName: '',
            },
            showPreStage: false,
            showDeploymentStage: true,
            showPostStage: false,
            requiredApprovals: '',
            showDeleteModal: false,
            shouldDeleteApp: true,
            showForceDeleteDialog: false,
            showNonCascadeDeleteDialog: false,
            isAdvanced: false,
            forceDeleteDialogMessage: '',
            forceDeleteDialogTitle: '',
            clusterName: '',
            allowedDeploymentTypes: [],
            dockerRegistries: null,
            selectedRegistry: null,
            generatedHelmPushAction: GeneratedHelmPush.DO_NOT_PUSH,
        }
        this.validationRules = new ValidationRules()
        this.handleRunInEnvCheckbox = this.handleRunInEnvCheckbox.bind(this)
        this.savePipeline = this.savePipeline.bind(this)
        this.selectEnvironment = this.selectEnvironment.bind(this)
        this.escFunction = this.escFunction.bind(this)
    }

    componentDidMount() {
        this.getInit()
        document.addEventListener('keydown', this.escFunction)
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.escFunction)
    }

    escFunction(event) {
        if ((event.keyCode === 27 || event.key === 'Escape') && typeof this.props.close === 'function') {
            this.props.close()
        }
    }

    onChangeSetGeneratedHelmPush = (selectedGeneratedHelmValue: string): void => {
        this.setState({
            generatedHelmPushAction: selectedGeneratedHelmValue,
        })
    }

    handleRegistryChange = (selectedRegistry): void => {
        this.state.errorForm.containerRegistryError =
            this.validationRules.containerRegistry(selectedRegistry.id) ||
            this.state.pipelineConfig.containerRegistryName
        this.setState({
            selectedRegistry,
            pipelineConfig: {
                ...this.state.pipelineConfig,
                containerRegistryName: selectedRegistry.id,
            },
        })
    }

    setRepositoryName = (event): void => {
        this.state.errorForm.repositoryError = this.validationRules.repository(event.target.value)
        this.setState({
            pipelineConfig: {
                ...this.state.pipelineConfig,
                repoName: event.target.value,
            },
        })
    }

    getDockerRegistry = () => {
        getDockerRegistryMinAuth(this.props.match.params.appId, true)
            .then((response) => {
                const dockerRegistries = response.result || []
                this.setState({
                    dockerRegistries,
                })
            })
            .catch((error) => {
                showError(error)
            })
    }

    getInit = () => {
        Promise.all([
            getDeploymentStrategyList(this.props.match.params.appId),
            getEnvironmentListMinPublic(true),
            getDockerRegistryMinAuth(this.props.match.params.appId, true),
        ]).then(([pipelineStrategyResponse, envResponse, dockerResponse]) => {
            const strategies = pipelineStrategyResponse.result.pipelineStrategy || []
            let defaultStrategy
            for (let i = 0; i < strategies.length; i++) {
                if (!this.allStrategies[strategies[i].deploymentTemplate]) {
                    this.allStrategies[strategies[i].deploymentTemplate] = {}
                }
                this.allStrategies[strategies[i].deploymentTemplate] = strategies[i].config
                if (strategies[i].default) {
                    defaultStrategy = strategies[i]
                }
            }
            if (defaultStrategy) {
                this.handleStrategy(defaultStrategy.deploymentTemplate)
            }
            this.noStrategyAvailable = strategies.length === 0
            this.setState({
                strategies,
                isAdvanced: !!this.props.match.params.cdPipelineId,
                view: this.props.match.params.cdPipelineId ? ViewType.LOADING : ViewType.FORM,
            })

            let environments = envResponse.result || []
            environments = environments.map((env) => {
                return {
                    id: env.id,
                    clusterName: env.cluster_name,
                    name: env.environment_name,
                    namespace: env.namespace || '',
                    active: false,
                    isClusterCdActive: env.isClusterCdActive,
                    description: env.description,
                    isVirtualEnvironment: env.isVirtualEnvironment, // Virtual environment is valid for virtual cluster on selection of environment
                    allowedDeploymentTypes: env.allowedDeploymentTypes || [],
                }
            })
            environments = environments.sort((a, b) => {
                return sortCallback('name', a, b)
            })

            let dockerRegistries = dockerResponse.result || []
            dockerRegistries = dockerRegistries.sort((a, b) => {
                return sortCallback('id', a, b)
            })
            this.setState({
                environments,
                dockerRegistries,
            })

            if (this.props.match.params.cdPipelineId) {
                this.getCDPipeline()
            } else {
                getCDPipelineNameSuggestion(this.props.match.params.appId)
                    .then((response) => {
                        this.setState({
                            pipelineConfig: {
                                ...this.state.pipelineConfig,
                                name: response.result,
                            },
                        })
                    })
                    .catch((error) => {})
            }
        })
    }

    getCDPipeline(): void {
        this.setState({
            view: ViewType.LOADING,
        })
        getCDPipelineConfig(this.props.match.params.appId, this.props.match.params.cdPipelineId)
            .then((data) => {
                const pipelineConfigFromRes = data.pipelineConfig
                this.updateStateFromResponse(pipelineConfigFromRes, data.environments)
            })
            .then(() => {
                getConfigMapAndSecrets(this.props.match.params.appId, this.state.pipelineConfig.environmentId)
                    .then((response) => {
                        this.configMapAndSecrets = response.result
                        this.setState({ view: ViewType.FORM })
                    })
                    .catch((error: ServerErrors) => {
                        showError(error)
                        this.setState({ code: error.code, loadingData: false })
                    })
            })
            .catch((error: ServerErrors) => {
                showError(error)
                this.setState({ code: error.code, view: ViewType.ERROR, loadingData: false })
            })
            .finally(() => {
                this.setState({
                    view: ViewType.FORM,
                })
            })
    }

    getPrePostStageInEnv = (isVirtualEnvironment: boolean, isRunPrePostStageInEnv: boolean): boolean => {
        if (isVirtualEnvironment) {
            return true
        }
        return isRunPrePostStageInEnv ?? false
    }

    updateStateFromResponse(pipelineConfigFromRes, environments): void {
        let { pipelineConfig, strategies } = { ...this.state }
        sortObjectArrayAlphabetically(environments, 'name')
        environments = environments.map((env) => {
            return {
                ...env,
                active: env.id === pipelineConfigFromRes.environmentId,
            }
        })
        const savedStrategies = []
        if (pipelineConfigFromRes.strategies) {
            for (let i = 0; i < pipelineConfigFromRes.strategies.length; i++) {
                savedStrategies.push({
                    ...pipelineConfigFromRes.strategies[i],
                    defaultConfig: this.allStrategies[pipelineConfigFromRes.strategies[i].deploymentTemplate],
                    jsonStr: JSON.stringify(pipelineConfigFromRes.strategies[i].config, null, 4),
                    yamlStr: yamlJsParser.stringify(pipelineConfigFromRes.strategies[i].config, { indent: 2 }),
                    selection: yamlJsParser.stringify(this.allStrategies[pipelineConfigFromRes.strategies[i].config], {
                        indent: 2,
                    }),
                    isCollapsed: true,
                })
                strategies = strategies.filter(
                    (strategy) =>
                        strategy.deploymentTemplate !== pipelineConfigFromRes.strategies[i].deploymentTemplate,
                )
            }
        }
        const env = environments.find((e) => e.id === pipelineConfigFromRes.environmentId)
        pipelineConfig = {
            ...pipelineConfigFromRes,
            ...(pipelineConfigFromRes.environmentId && env ? { namespace: env.namespace } : {}),
            strategies: savedStrategies,
            repoName: pipelineConfigFromRes.repoName,
            containerRegistryName: pipelineConfigFromRes.containerRegistryName,
            manifestStorageType:
                pipelineConfigFromRes.deploymentAppType === DeploymentAppTypes.MANIFEST_PUSH
                    ? GeneratedHelmPush.PUSH
                    : 'helm_repo',
            preStage: {
                ...pipelineConfigFromRes.preStage,
                config: pipelineConfigFromRes.preStage.config || '',
                triggerType: pipelineConfigFromRes.preStage.triggerType || TriggerType.Auto,
                switch: SwitchItemValues.Config,
                isCollapse: isEmpty(pipelineConfigFromRes.preStage.config),
            },
            postStage: {
                ...pipelineConfigFromRes.postStage,
                config: pipelineConfigFromRes.postStage.config || '',
                triggerType: pipelineConfigFromRes.postStage.triggerType || TriggerType.Auto,
                switch: SwitchItemValues.Config,
                isCollapse: isEmpty(pipelineConfigFromRes.postStage.config),
            },
            preStageConfigMapSecretNames: {
                configMaps: pipelineConfigFromRes.preStageConfigMapSecretNames.configMaps
                    ? pipelineConfigFromRes.preStageConfigMapSecretNames.configMaps
                    : [],
                secrets: pipelineConfigFromRes.preStageConfigMapSecretNames.secrets
                    ? pipelineConfigFromRes.preStageConfigMapSecretNames.secrets
                    : [],
            },
            postStageConfigMapSecretNames: {
                configMaps: pipelineConfigFromRes.postStageConfigMapSecretNames.configMaps
                    ? pipelineConfigFromRes.postStageConfigMapSecretNames.configMaps
                    : [],
                secrets: pipelineConfigFromRes.postStageConfigMapSecretNames.secrets
                    ? pipelineConfigFromRes.postStageConfigMapSecretNames.secrets
                    : [],
            },
            runPreStageInEnv: this.getPrePostStageInEnv(
                this.state.pipelineConfig.isVirtualEnvironment,
                pipelineConfigFromRes.runPreStageInEnv,
            ),
            runPostStageInEnv: this.getPrePostStageInEnv(
                this.state.pipelineConfig.isVirtualEnvironment,
                pipelineConfigFromRes.runPostStageInEnv,
            ),
            isClusterCdActive: pipelineConfigFromRes.isClusterCdActive || false,
            deploymentAppType: pipelineConfigFromRes.deploymentAppType || '',
        }
        this.preStage = pipelineConfigFromRes.preStage.config || ''
        this.postStage = pipelineConfigFromRes.postStage.config || ''
        const showPreStage =
            !isEmpty(pipelineConfigFromRes.preStage.config) ||
            !!pipelineConfig.preStageConfigMapSecretNames.configMaps.length ||
            !!pipelineConfig.preStageConfigMapSecretNames.secrets.length
        const showPostStage =
            !isEmpty(pipelineConfigFromRes.postStage.config) ||
            !!pipelineConfig.postStageConfigMapSecretNames.configMaps.length ||
            !!pipelineConfig.postStageConfigMapSecretNames.secrets.length

        this.setState({
            view: ViewType.FORM,
            loadingData: false,
            strategies,
            pipelineConfig,
            environments,
            showPreStage,
            showPostStage,
            showError: false,
            requiredApprovals: `${pipelineConfigFromRes.userApprovalConfig?.requiredCount || ''}`,
            allowedDeploymentTypes: env.allowedDeploymentTypes || [],
            generatedHelmPushAction:
                pipelineConfigFromRes.deploymentAppType === DeploymentAppTypes.MANIFEST_PUSH
                    ? GeneratedHelmPush.PUSH
                    : GeneratedHelmPush.DO_NOT_PUSH,
            selectedRegistry: this.state.dockerRegistries.find(
                (dockerRegistry) => dockerRegistry.id === pipelineConfigFromRes.containerRegistryName,
            ),
        })
    }

    toggleStrategy(selection: string): void {
        const { pipelineConfig } = { ...this.state }
        const savedStrategies = this.state.pipelineConfig.strategies.map((strategy) => {
            return {
                ...strategy,
                isCollapsed: strategy.deploymentTemplate === selection ? !strategy.isCollapsed : strategy.isCollapsed,
            }
        })
        pipelineConfig.strategies = savedStrategies
        this.setState({ pipelineConfig, view: ViewType.FORM })
    }

    setDefaultStrategy(selection: string): void {
        // only one strategy can be default in [...savedStrategies, ...strategies]
        const strategies = this.state.strategies.map((strategy) => {
            return {
                ...strategy,
                default: strategy.deploymentTemplate == selection,
            }
        })
        const savedStrategies = this.state.pipelineConfig.strategies.map((strategy) => {
            return {
                ...strategy,
                default: strategy.deploymentTemplate == selection,
            }
        })
        const { pipelineConfig } = { ...this.state }
        pipelineConfig.strategies = savedStrategies
        this.setState({ pipelineConfig, strategies })
    }

    selectStrategy(value: string): void {
        const selection = this.state.strategies.find((strategy) => strategy.deploymentTemplate == value)
        const strategies = this.state.strategies.filter((strategy) => strategy.deploymentTemplate != value)

        const state = { ...this.state }
        if (this.state.pipelineConfig.strategies.length == 0) {
            selection.default = true
        } else {
            selection.default = false
        }

        selection['defaultConfig'] = this.allStrategies[selection.deploymentTemplate]
        selection['jsonStr'] = JSON.stringify(this.allStrategies[selection.deploymentTemplate], null, 4)
        selection['yamlStr'] = yamlJsParser.stringify(this.allStrategies[selection.deploymentTemplate], { indent: 2 })
        selection['isCollapsed'] = true

        state.strategies = strategies
        state.pipelineConfig.strategies.push(selection)
        this.setState(state)
    }

    deleteStrategy(selection: string): void {
        const removedStrategy = this.state.pipelineConfig.strategies.find(
            (savedStrategy) => selection === savedStrategy.deploymentTemplate,
        )
        if (removedStrategy.default) {
            toast.error('Cannot remove default strategy')
            return
        }
        const savedStrategies = this.state.pipelineConfig.strategies.filter(
            (savedStrategy) => selection !== savedStrategy.deploymentTemplate,
        )
        const { pipelineConfig, strategies } = { ...this.state }
        strategies.push(removedStrategy)
        pipelineConfig.strategies = savedStrategies
        this.setState({ strategies, pipelineConfig })
    }

    handleStrategy(value: string): void {
        let newSelection
        newSelection = {}
        newSelection['deploymentTemplate'] = value
        newSelection['defaultConfig'] = this.allStrategies[value]
        newSelection['config'] = this.allStrategies[value]
        newSelection['isCollapsed'] = true
        newSelection['default'] = true
        newSelection['jsonStr'] = JSON.stringify(this.allStrategies[value], null, 4)
        newSelection['yamlStr'] = yamlJsParser.stringify(this.allStrategies[value], { indent: 2 })

        const { pipelineConfig } = { ...this.state }
        pipelineConfig.strategies.push(newSelection)
        pipelineConfig.strategies = [newSelection]
        this.setState({ pipelineConfig })
    }

    selectEnvironment = (selection: Environment): void => {
        const { pipelineConfig, errorForm } = { ...this.state }

        if (selection) {
            const list = this.state.environments.map((item) => {
                return {
                    ...item,
                    active: item.id == selection.id,
                }
            })
            pipelineConfig.environmentId = selection.id
            pipelineConfig.namespace = selection.namespace
            pipelineConfig.isVirtualEnvironment = selection.isVirtualEnvironment
            errorForm.envNameError = this.validationRules.environment(selection.id)
            errorForm.nameSpaceError =
                !this.state.pipelineConfig.isVirtualEnvironment && this.validationRules.namespace(selection.namespace)

            pipelineConfig.preStageConfigMapSecretNames = {
                configMaps: [],
                secrets: [],
            }
            pipelineConfig.postStageConfigMapSecretNames = {
                configMaps: [],
                secrets: [],
            }
            pipelineConfig.isClusterCdActive = selection.isClusterCdActive
            pipelineConfig.runPreStageInEnv = this.getPrePostStageInEnv(
                selection.isVirtualEnvironment,
                pipelineConfig.isClusterCdActive && pipelineConfig.runPreStageInEnv,
            )
            pipelineConfig.runPostStageInEnv = this.getPrePostStageInEnv(
                selection.isVirtualEnvironment,
                pipelineConfig.isClusterCdActive && pipelineConfig.runPostStageInEnv,
            )
            pipelineConfig.deploymentAppType = getDeploymentAppType(
                selection.allowedDeploymentTypes,
                this.state.pipelineConfig.deploymentAppType,
                selection.isVirtualEnvironment,
            )
            this.setState(
                {
                    environments: list,
                    pipelineConfig,
                    errorForm,
                    allowedDeploymentTypes: selection.allowedDeploymentTypes,
                },
                () => {
                    getConfigMapAndSecrets(this.props.match.params.appId, this.state.pipelineConfig.environmentId)
                        .then((response) => {
                            this.configMapAndSecrets = response.result
                            this.setState({ view: ViewType.FORM, errorForm })
                        })
                        .catch((error: ServerErrors) => {
                            showError(error)
                            this.setState({ code: error.code, loadingData: false })
                        })
                },
            )
        } else {
            const list = this.state.environments.map((item) => {
                return {
                    ...item,
                    active: false,
                }
            })
            pipelineConfig.environmentId = 0
            pipelineConfig.namespace = ''
            pipelineConfig.isVirtualEnvironment = false
            errorForm.envNameError = this.validationRules.environment(pipelineConfig.environmentId)
            this.setState({ environments: list, pipelineConfig, errorForm })
        }
    }

    // @stage: 'preStageConfigMapSecretNames' | 'postStageConfigMapSecretNames'
    handleConfigmapAndSecretsChange = (selection, stage) => {
        selection = selection || []
        const state = { ...this.state }
        if (selection.length) {
            const configmaps = selection.filter((e) => e.type === 'configmaps').map((e) => e.name)
            const secrets = selection.filter((e) => e.type === 'secrets').map((e) => e.name)
            state.pipelineConfig[stage]['configMaps'] = configmaps
            state.pipelineConfig[stage]['secrets'] = secrets
        } else {
            state.pipelineConfig[stage]['configMaps'] = []
            state.pipelineConfig[stage]['secrets'] = []
        }
        this.setState(state)
    }

    handleRunInEnvCheckbox(event, stageType: 'preStage' | 'postStage') {
        const { pipelineConfig } = { ...this.state }
        if (stageType === 'preStage') {
            pipelineConfig.runPreStageInEnv = this.getPrePostStageInEnv(
                this.state.pipelineConfig.isVirtualEnvironment,
                !pipelineConfig.runPreStageInEnv,
            )
        }
        if (stageType === 'postStage') {
            pipelineConfig.runPostStageInEnv = this.getPrePostStageInEnv(
                this.state.pipelineConfig.isVirtualEnvironment,
                !pipelineConfig.runPostStageInEnv,
            )
        }
        this.setState({ pipelineConfig })
    }

    handleTriggerTypeChange = (event) => {
        const { pipelineConfig } = { ...this.state }
        pipelineConfig.triggerType = event.target.value
        this.setState({ pipelineConfig })
    }

    handleDeploymentAppTypeChange = (event) => {
        const { pipelineConfig } = { ...this.state }
        pipelineConfig.deploymentAppType = event.target.value
        this.setState({ pipelineConfig })
    }

    handlePipelineName = (event) => {
        const { pipelineConfig, errorForm } = { ...this.state }
        pipelineConfig.name = event.target.value
        errorForm.pipelineNameError = this.validationRules.name(pipelineConfig.name)
        this.setState({ pipelineConfig, errorForm })
    }

    handleNamespaceChange = (event, environment): void => {
        const { pipelineConfig } = { ...this.state }
        pipelineConfig.namespace = event.target.value
        this.setState({ pipelineConfig })
    }

    handleStrategyChange(value, selection: string, key: 'json' | 'yaml'): void {
        let json
        let jsonStr
        let yamlStr
        if (key === 'json') {
            jsonStr = value
            try {
                json = JSON.parse(jsonStr)
                yamlStr = yamlJsParser.stringify(json, { indent: 2 })
            } catch (error) {}
        } else {
            yamlStr = value
            try {
                json = yamlJsParser.parse(yamlStr)
                jsonStr = JSON.stringify(json, undefined, 2)
            } catch (error) {}
        }
        const state = { ...this.state }
        const strategies = this.state.pipelineConfig.strategies.map((strategy) => {
            if (strategy.deploymentTemplate === selection) {
                if (json) {
                    strategy['config'] = json
                }
                if (jsonStr) {
                    strategy['jsonStr'] = jsonStr
                }
                if (yamlStr) {
                    strategy['yamlStr'] = yamlStr
                }
            }
            return strategy
        })
        state.pipelineConfig.strategies = strategies
        this.setState(state)
    }

    // @value: MANUAL | AUTOMATIC | yaml string
    handleStageConfigChange = (
        value: string,
        stageType: 'preStage' | 'postStage',
        key: 'triggerType' | 'config' | 'switch',
    ) => {
        const { pipelineConfig } = { ...this.state }
        if (key !== 'config') {
            pipelineConfig[stageType][key] = value
        } else if (pipelineConfig[stageType].switch === SwitchItemValues.Config) {
            pipelineConfig[stageType][key] = value
        }
        this.setState({ pipelineConfig })
    }

    savePipeline() {
        const { pipelineConfig, errorForm } = { ...this.state }
        errorForm.pipelineNameError = this.validationRules.name(pipelineConfig.name)
        if (!this.state.pipelineConfig.isVirtualEnvironment) {
            errorForm.nameSpaceError = this.validationRules.namespace(pipelineConfig.namespace)
        }
        if (this.state.generatedHelmPushAction === GeneratedHelmPush.PUSH) {
            errorForm.containerRegistryError = this.validationRules.containerRegistry(
                pipelineConfig.containerRegistryName || '',
            )
            errorForm.repositoryError = this.validationRules.repository(pipelineConfig.repoName)
        }
        errorForm.envNameError = this.validationRules.environment(pipelineConfig.environmentId)
        this.setState({ errorForm })
        let valid =
            !!pipelineConfig.environmentId &&
            errorForm.pipelineNameError.isValid &&
            (!!pipelineConfig.isVirtualEnvironment || !!pipelineConfig.namespace) &&
            !!pipelineConfig.triggerType &&
            !!(pipelineConfig.deploymentAppType || window._env_.HIDE_GITOPS_OR_HELM_OPTION)

        if (!pipelineConfig.name || (!pipelineConfig.isVirtualEnvironment && !pipelineConfig.namespace)) {
            toast.error(MULTI_REQUIRED_FIELDS_MSG)
            return
        }

        if (this.state.generatedHelmPushAction === GeneratedHelmPush.PUSH) {
            valid = !!pipelineConfig.containerRegistryName && !!pipelineConfig.repoName
        }
        if (!valid) {
            this.setState({ loadingData: false })
            return
        }

        this.setState({ loadingData: true })
        const pipeline = {
            appWorkflowId: +this.props.match.params.workflowId,
            ...this.state.pipelineConfig,
            deploymentTemplate:
                this.state.pipelineConfig.strategies.length > 0
                    ? this.state.pipelineConfig.strategies.find((savedStrategy) => savedStrategy.default)
                          .deploymentTemplate
                    : null,
            strategies: this.state.pipelineConfig.strategies.map((savedStrategy) => {
                return {
                    deploymentTemplate: savedStrategy.deploymentTemplate,
                    config: savedStrategy.config,
                    default: savedStrategy.default,
                }
            }),
            userApprovalConfig:
                this.state.requiredApprovals?.length > 0
                    ? {
                          requiredCount: +this.state.requiredApprovals,
                      }
                    : null,
            containerRegistryName:
                this.state.generatedHelmPushAction === GeneratedHelmPush.PUSH
                    ? this.state.pipelineConfig.containerRegistryName
                    : '',
            repoName:
                this.state.generatedHelmPushAction === GeneratedHelmPush.PUSH ? this.state.pipelineConfig.repoName : '',
            manifestStorageType: this.state.generatedHelmPushAction === GeneratedHelmPush.PUSH ? 'helm_repo' : '',
        }
        const request = {
            appId: parseInt(this.props.match.params.appId),
        }
        pipeline.preStage.config = pipeline.preStage.config.replace(/^\s+|\s+$/g, '')
        pipeline.postStage.config = pipeline.postStage.config.replace(/^\s+|\s+$/g, '')

        if (this.state.pipelineConfig.isVirtualEnvironment) {
            pipeline.deploymentAppType =
                this.state.generatedHelmPushAction === GeneratedHelmPush.PUSH
                    ? DeploymentAppTypes.MANIFEST_PUSH
                    : DeploymentAppTypes.MANIFEST_DOWNLOAD
            pipeline.triggerType =
                this.state.generatedHelmPushAction === GeneratedHelmPush.DO_NOT_PUSH
                    ? TriggerType.Manual
                    : this.state.pipelineConfig.triggerType
            pipeline.preStage.triggerType =
                this.state.generatedHelmPushAction === GeneratedHelmPush.DO_NOT_PUSH
                    ? TriggerType.Manual
                    : this.state.pipelineConfig.preStage.triggerType
            pipeline.postStage.triggerType =
                this.state.generatedHelmPushAction === GeneratedHelmPush.DO_NOT_PUSH
                    ? TriggerType.Manual
                    : this.state.pipelineConfig.postStage.triggerType
        }

        let msg
        if (!this.props.match.params.cdPipelineId) {
            request['pipelines'] = [pipeline]
            delete pipeline['id']
            msg = 'Pipeline Created Successfully'
        } else {
            request['pipeline'] = pipeline
            request['action'] = CD_PATCH_ACTION.UPDATE
            msg = 'Pipeline Updated Successfully'
        }
        const promise = this.props.match.params.cdPipelineId ? updateCDPipeline(request) : saveCDPipeline(request)
        promise
            .then((response) => {
                if (response.result) {
                    const pipelineConfigFromRes = response.result.pipelines[0]
                    this.updateStateFromResponse(pipelineConfigFromRes, this.state.environments)
                    let envName = this.state.pipelineConfig.environmentName
                    if (!envName) {
                        const selectedEnv: Environment = this.state.environments.find(
                            (env) => env.id == this.state.pipelineConfig.environmentId,
                        )
                        envName = selectedEnv.name
                    }
                    this.props.close(
                        this.state.pipelineConfig.parentPipelineType !== PipelineType.WEBHOOK,
                        this.state.pipelineConfig.environmentId,
                        envName,
                        this.props.match.params.cdPipelineId
                            ? 'Deployment pipeline updated'
                            : 'Deployment pipeline created',
                        !this.props.match.params.cdPipelineId,
                    )
                    this.props.getWorkflows()
                }
            })
            .catch((error: ServerErrors) => {
                showError(error)
                this.setState({ code: error.code, loadingData: false })
            })
    }

    getSelectedConfigMapAndSecrets(stage) {
        const configMaps = this.state.pipelineConfig[stage].configMaps.map((item) => {
            return {
                type: 'configmaps',
                name: item,
            }
        })
        const secrets = this.state.pipelineConfig[stage].secrets.map((item) => {
            return {
                type: 'secrets',
                name: item,
            }
        })
        const selections = configMaps.concat(secrets)
        return selections
    }

    setDeleteApp = () => {
        this.setState({ shouldDeleteApp: !this.state.shouldDeleteApp })
    }

    setForceDeleteDialogData = (serverError) => {
        this.setState({ showForceDeleteDialog: true })
        if (serverError instanceof ServerErrors && Array.isArray(serverError.errors)) {
            serverError.errors.map(({ userMessage, internalMessage }) => {
                this.setState({ forceDeleteDialogMessage: internalMessage, forceDeleteDialogTitle: userMessage })
            })
        }
    }

    deleteCD = (force: boolean, cascadeDelete: boolean) => {
        const isPartialDelete =
            this.state.pipelineConfig?.deploymentAppType === DeploymentAppTypes.GITOPS &&
            this.state.pipelineConfig.deploymentAppCreated &&
            !force
        const payload = {
            action: isPartialDelete ? CD_PATCH_ACTION.DEPLOYMENT_PARTIAL_DELETE : CD_PATCH_ACTION.DELETE,
            appId: parseInt(this.props.match.params.appId),
            pipeline: {
                id: this.state.pipelineConfig.id,
            },
        }
        deleteCDPipeline(payload, force, cascadeDelete)
            .then((response) => {
                if (response.result) {
                    if (
                        cascadeDelete &&
                        !response.result.deleteResponse?.clusterReachable &&
                        !response.result.deleteResponse?.deleteInitiated
                    ) {
                        this.setState({
                            loadingData: false,
                            showDeleteModal: false,
                            showNonCascadeDeleteDialog: true,
                            clusterName: response.result.deleteResponse?.clusterName,
                        })
                    } else {
                        toast.success(TOAST_INFO.PIPELINE_DELETION_INIT)
                        this.setState({
                            loadingData: false,
                            showDeleteModal: false,
                            showForceDeleteDialog: false,
                            showNonCascadeDeleteDialog: false,
                        })
                        this.props.close()
                        if (this.isWebhookCD) {
                            this.props.refreshParentWorkflows()
                        }
                        this.props.getWorkflows()
                    }
                }
            })
            .catch((error: ServerErrors) => {
                if (!force && error.code != 403) {
                    this.setForceDeleteDialogData(error)
                    this.setState({
                        code: error.code,
                        loadingData: false,
                        showDeleteModal: false,
                        showNonCascadeDeleteDialog: false,
                        showForceDeleteDialog: true,
                    })
                } else {
                    showError(error)
                }
            })
    }

    handleDeletePipeline = (deleteAction: DELETE_ACTION) => {
        switch (deleteAction) {
            case DELETE_ACTION.DELETE:
                return this.deleteCD(false, true)
            case DELETE_ACTION.NONCASCADE_DELETE:
                return this.state.pipelineConfig?.deploymentAppType === DeploymentAppTypes.GITOPS
                    ? this.deleteCD(false, false)
                    : this.deleteCD(false, true)
            case DELETE_ACTION.FORCE_DELETE:
                return this.deleteCD(true, false)
        }
    }

    onClickHideNonCascadeDeletePopup = () => {
        this.setState({ showNonCascadeDeleteDialog: false })
    }

    onClickNonCascadeDelete = () => {
        this.setState({ showNonCascadeDeleteDialog: false })
        this.handleDeletePipeline(DELETE_ACTION.NONCASCADE_DELETE)
    }

    deleteStage(key: 'preStage' | 'postStage') {
        const { pipelineConfig } = { ...this.state }
        pipelineConfig[key].config = ''

        if (key === 'preStage') {
            pipelineConfig.preStageConfigMapSecretNames = {
                secrets: [],
                configMaps: [],
            }
            pipelineConfig.runPreStageInEnv = false
            this.setState({ pipelineConfig, showPreStage: !this.state.showPreStage })
        } else {
            pipelineConfig.postStageConfigMapSecretNames = {
                secrets: [],
                configMaps: [],
            }
            pipelineConfig.runPostStageInEnv = false
            this.setState({ showPostStage: !this.state.showPostStage })
        }
    }

    handleAdvanceClick = () => {
        const strategies = this.state.strategies.filter(
            (strategy) => strategy.deploymentTemplate != this.state.pipelineConfig.strategies[0].deploymentTemplate,
        )
        const state = { ...this.state }
        state.strategies = strategies
        state.isAdvanced = true
        this.setState(state)
    }

    closeCDDeleteModal = () => {
        this.setState({ showDeleteModal: false })
    }

    renderHeader() {
        const title =
            this.isWebhookCD && this.props.match.params.workflowId === '0'
                ? DEPLOY_IMAGE_EXTERNALSOURCE
                : this.props.match.params.cdPipelineId
                  ? EDIT_DEPLOYMENT_PIPELINE
                  : CREATE_DEPLOYMENT_PIPELINE
        return (
            <>
                <div className="p-20 flex flex-align-center flex-justify">
                    <h2 className="fs-16 fw-6 lh-1-43 m-0">{title}</h2>
                    <button
                        type="button"
                        className="dc__transparent flex icon-dim-24"
                        onClick={() => {
                            this.props.close()
                        }}
                    >
                        <Close className="icon-dim-24" />
                    </button>
                </div>
                <div className="divider m-0" />
            </>
        )
    }

    renderStrategyOptions = () => {
        return (
            <Select
                rootClassName="deployment-strategy-dropdown br-0 bw-0 w-150"
                onChange={(e) => this.selectStrategy(e.target.value)}
            >
                <Select.Button rootClassName="right" hideArrow>
                    <span className="flex cb-5 fw-6">
                        <Add className="icon-dim-20 mr-8 fcb-5 dc__vertical-align-middle" />
                        Add Strategy
                    </span>
                </Select.Button>
                {this.state.strategies.map((strategy) => {
                    return (
                        <Select.Option
                            rootClassName="select-option--deployment-strategy"
                            key={strategy.deploymentTemplate}
                            value={strategy.deploymentTemplate}
                        >
                            {strategy.deploymentTemplate}
                        </Select.Option>
                    )
                })}
            </Select>
        )
    }

    renderDeploymentStrategy() {
        if (this.noStrategyAvailable) {
            return null
        }

        const renderDeploymentStrategyTippy = () => {
            return (
                <TippyCustomized
                    theme={TippyTheme.white}
                    className="flex w-300 h-100 fcv-5"
                    placement="right"
                    Icon={Help}
                    heading="Deployment strategy"
                    infoText="Add one or more deployment strategies. You can choose from selected strategy while deploying manually to this environment."
                    showCloseButton
                    trigger="click"
                    interactive
                    documentationLinkText="View Documentation"
                >
                    <div className="icon-dim-16 fcn-9 ml-8 cursor">
                        <Question />
                    </div>
                </TippyCustomized>
            )
        }

        return (
            <div className="form__row">
                <p className="form__label form__label--caps mb-8-imp">
                    <div className="flex  dc__content-space mt-16">
                        <div className="flex left">
                            <span>Deployment Strategy</span>
                            {renderDeploymentStrategyTippy()}
                        </div>
                        {this.renderStrategyOptions()}
                    </div>
                </p>
                {this.state.pipelineConfig.strategies.map((strategy) => {
                    return (
                        <div key={strategy.deploymentTemplate} className="deployment-strategy__info">
                            <div className="deployment-strategy__info-header">
                                <span>
                                    <span>{strategy.deploymentTemplate}</span>
                                    {strategy.default ? (
                                        <span className="default-strategy">Default</span>
                                    ) : (
                                        <span
                                            className="set-as-default"
                                            onClick={(event) => this.setDefaultStrategy(strategy.deploymentTemplate)}
                                        >
                                            Set Default
                                        </span>
                                    )}
                                </span>
                                <span className="deployment-strategy__controls">
                                    <button
                                        type="button"
                                        className="dc__transparent"
                                        onClick={(event) => this.toggleStrategy(strategy.deploymentTemplate)}
                                    >
                                        <img src={settings} alt="config" className="icon-dim-20" />
                                    </button>
                                    <button
                                        type="button"
                                        className="dc__transparent"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            this.deleteStrategy(strategy.deploymentTemplate)
                                        }}
                                    >
                                        <img src={trash} alt="trash" className="icon-dim-20" />
                                    </button>
                                </span>
                            </div>
                            {strategy.isCollapsed ? null : (
                                <div>
                                    <CodeEditor
                                        height={300}
                                        value={strategy.yamlStr}
                                        mode="yaml"
                                        onChange={(event) =>
                                            this.handleStrategyChange(event, strategy.deploymentTemplate, 'yaml')
                                        }
                                    >
                                        <CodeEditor.Header className="code-editor" />
                                    </CodeEditor>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        )
    }

    renderPrePostStageType = (key) => {
        return (
            <>
                <label className="form__label form__label--sentence dc__bold">
                    When do you want this stage to trigger?
                </label>
                <RadioGroup
                    value={this.state.pipelineConfig[key].triggerType}
                    name={`${key}-trigger-type`}
                    onChange={(event) => {
                        this.handleStageConfigChange(event.target.value, key, 'triggerType')
                    }}
                >
                    <RadioGroupItem dataTestId="cd-auto-mode-button" value={TriggerType.Auto}>
                        Automatic
                    </RadioGroupItem>
                    <RadioGroupItem dataTestId="cd-manual-mode-button" value={TriggerType.Manual}>
                        Manual
                    </RadioGroupItem>
                </RadioGroup>
            </>
        )
    }

    renderDeploymentStageDetails(key: 'preStage' | 'postStage') {
        let configmapKey
        if (key == 'preStage') {
            configmapKey = 'preStageConfigMapSecretNames'
        } else {
            configmapKey = 'postStageConfigMapSecretNames'
        }
        const selections = this.getSelectedConfigMapAndSecrets(configmapKey)
        const codeEditorBody =
            this.state.pipelineConfig[key].switch === SwitchItemValues.Config
                ? this.state.pipelineConfig[key].config
                : yamlJsParser.stringify(config[key], { indent: 2 })
        const runInEnv =
            key === 'preStage'
                ? this.state.pipelineConfig.runPreStageInEnv
                : this.state.pipelineConfig.runPostStageInEnv
        function getOptionLabel(option) {
            if (option.type === CONFIGMAPS_SECRETS.configmaps) {
                return (
                    <div className="dropdown__option">
                        <File className="icon-dim-16" />
                        <span className="ml-8 fs-12 dc__align-center">{option.name}</span>
                    </div>
                )
            }
            return (
                <div className="dropdown__option">
                    <Key className="icon-dim-16" />
                    <span className="ml-8 fs-12 dc__align-center">{option.name}</span>
                </div>
            )
        }

        function getOptionValue(option) {
            return `${option.name}${option.type}`
        }

        const onChangeOption = (selected) => {
            this.handleConfigmapAndSecretsChange(selected, configmapKey)
        }
        return (
            <div className="cd-stage mt-12 ml-60">
                <div className="form__row">
                    <img
                        src={trash}
                        alt="delete"
                        className="delete-stage-icon cursor"
                        onClick={(e) => this.deleteStage(key)}
                    />
                    {!(
                        this.state.pipelineConfig.isVirtualEnvironment &&
                        this.state.generatedHelmPushAction === GeneratedHelmPush.DO_NOT_PUSH
                    ) && this.renderPrePostStageType(key)}
                </div>
                <div className="form__row">
                    <label className="form__label form__label--sentence dc__bold">Select Configmap and Secrets</label>
                    <ReactSelect
                        menuPosition={this.state.isAdvanced ? null : 'fixed'}
                        closeMenuOnScroll
                        classNamePrefix="select-config-secret-dropdown"
                        isMulti
                        placeholder="Select Configmap and Secrets"
                        isClearable
                        value={selections}
                        options={this.configMapAndSecrets}
                        formatOptionLabel={getOptionLabel}
                        getOptionValue={getOptionValue}
                        onChange={onChangeOption}
                        components={{
                            IndicatorSeparator: null,
                            DropdownIndicator,
                            Option,
                        }}
                        styles={{ ...styles }}
                    />
                </div>
                <div className="code-editor">
                    <CodeEditor
                        value={codeEditorBody}
                        height={300}
                        mode="yaml"
                        readOnly={this.state.pipelineConfig[key].switch !== SwitchItemValues.Config}
                        onChange={
                            this.state.pipelineConfig[key].switch === SwitchItemValues.Config
                                ? (resp) => {
                                      this.handleStageConfigChange(resp, key, 'config')
                                  }
                                : null
                        }
                    >
                        <CodeEditor.Header>
                            <Switch
                                value={this.state.pipelineConfig[key].switch}
                                name={`${key}`}
                                onChange={(event) => {
                                    this.handleStageConfigChange(event.target.value, key, 'switch')
                                }}
                            >
                                <SwitchItem value={SwitchItemValues.Config}> Config </SwitchItem>
                                <SwitchItem value={SwitchItemValues.Sample}> Sample Script</SwitchItem>
                            </Switch>
                            <span className="ml-4">
                                <CodeEditor.ValidationError />
                            </span>
                        </CodeEditor.Header>
                    </CodeEditor>
                </div>
                <div
                    className={
                        this.state.pipelineConfig.isClusterCdActive
                            ? 'dc__position-rel cd-checkbox'
                            : 'dc__position-rel cd-checkbox cd-checkbox-tooltip'
                    }
                >
                    <Checkbox
                        isChecked={runInEnv}
                        value={CHECKBOX_VALUE.CHECKED}
                        disabled={!this.state.pipelineConfig.isClusterCdActive}
                        onChange={(event) => {
                            this.handleRunInEnvCheckbox(event, key)
                        }}
                    >
                        <span className="mr-5">Execute in application Environment</span>
                    </Checkbox>
                    {!this.state.pipelineConfig.isVirtualEnvironment && (
                        <span className="checkbox-tooltip-body">
                            This Environment is not configured to run on devtron worker.
                        </span>
                    )}
                </div>
            </div>
        )
    }

    renderNamespaceInfo(namespaceEditable: boolean) {
        if (namespaceEditable) {
            return (
                <div className="dc__info-container info__container--cd-pipeline">
                    <Info />
                    <div className="flex column left">
                        <div className="dc__info-title">Set Namespace</div>
                        <div className="dc__info-subtitle">
                            The entered namespace will be applicable to selected environment across all the pipelines
                            for this application.
                        </div>
                    </div>
                </div>
            )
        }
        return null
    }

    renderTriggerType() {
        return (
            <div className="cd-pipeline__trigger-type">
                <label className="form__label form__label--sentence dc__bold">
                    When do you want the pipeline to execute?
                </label>
                <RadioGroup
                    value={
                        this.state.pipelineConfig.triggerType ? this.state.pipelineConfig.triggerType : TriggerType.Auto
                    }
                    name="trigger-type"
                    onChange={this.handleTriggerTypeChange}
                    className="chartrepo-type__radio-group"
                >
                    <RadioGroupItem dataTestId="cd-auto-mode-button" value={TriggerType.Auto}>
                        Automatic
                    </RadioGroupItem>
                    <RadioGroupItem dataTestId="cd-manual-mode-button" value={TriggerType.Manual}>
                        Manual
                    </RadioGroupItem>
                </RadioGroup>
            </div>
        )
    }

    renderDeploymentAppType() {
        return (
            <div className="cd-pipeline__deployment-type mt-16">
                <label className="form__label form__label--sentence dc__bold">How do you want to deploy?</label>
                <DeploymentAppRadioGroup
                    isDisabled={!!this.props.match.params.cdPipelineId}
                    deploymentAppType={this.state.pipelineConfig.deploymentAppType ?? DeploymentAppTypes.HELM}
                    handleOnChange={this.handleDeploymentAppTypeChange}
                    allowedDeploymentTypes={this.state.allowedDeploymentTypes}
                    rootClassName={`chartrepo-type__radio-group ${
                        !this.props.match.params.cdPipelineId ? 'bcb-5' : ''
                    }`}
                    isFromCDPipeline
                />
            </div>
        )
    }

    renderDeleteCDModal() {
        if (this.props.match.params.cdPipelineId) {
            if (this.state.showDeleteModal) {
                return (
                    <DeleteDialog
                        title={`Delete '${this.state.pipelineConfig.name}' ?`}
                        description={`Are you sure you want to delete this CD Pipeline from '${this.props.appName}' ?`}
                        delete={() => this.handleDeletePipeline(DELETE_ACTION.DELETE)}
                        closeDelete={this.closeCDDeleteModal}
                    />
                )
            }
            if (!this.state.showDeleteModal && this.state.showForceDeleteDialog) {
                return (
                    <ForceDeleteDialog
                        forceDeleteDialogTitle={this.state.forceDeleteDialogTitle}
                        onClickDelete={() => this.handleDeletePipeline(DELETE_ACTION.FORCE_DELETE)}
                        closeDeleteModal={() => this.setState({ showForceDeleteDialog: false })}
                        forceDeleteDialogMessage={this.state.forceDeleteDialogMessage}
                    />
                )
            }
            if (!this.state.showDeleteModal && this.state.showNonCascadeDeleteDialog) {
                return (
                    <ClusterNotReachableDailog
                        clusterName={this.state.clusterName}
                        onClickCancel={this.onClickHideNonCascadeDeletePopup}
                        onClickDelete={this.onClickNonCascadeDelete}
                    />
                )
            }
        }
        return null
    }

    renderSecondaryButton() {
        if (this.props.match.params.cdPipelineId) {
            const canDeletePipeline = this.props.downstreamNodeSize === 0
            const message =
                this.props.downstreamNodeSize > 0
                    ? 'This Pipeline cannot be deleted as it has connected CD pipeline'
                    : ''
            return (
                <ConditionalWrap
                    condition={!canDeletePipeline}
                    wrap={(children) => (
                        <Tippy className="default-tt" content={message}>
                            <div>{children}</div>
                        </Tippy>
                    )}
                >
                    <button
                        data-testid="cd-delete-pipeline-button"
                        type="button"
                        className="cta cta--workflow delete mr-16"
                        disabled={!canDeletePipeline}
                        onClick={() => {
                            this.setState({ showDeleteModal: true })
                        }}
                    >
                        Delete Pipeline
                    </button>
                </ConditionalWrap>
            )
        }
        if (this.state.isAdvanced) {
            return (
                <button
                    type="button"
                    className="cta cta--workflow cancel mr-16"
                    onClick={() => {
                        this.props.close()
                    }}
                >
                    Cancel
                </button>
            )
        }
        return (
            !this.isWebhookCD && (
                <button
                    type="button"
                    data-testid="cd-build-pipeline-advanced-options-button"
                    className="cta cta--workflow cancel mr-16"
                    onClick={() => {
                        this.handleAdvanceClick()
                    }}
                >
                    Advanced Options
                </button>
            )
        )
    }

    singleOption = (props) => {
        return <EnvFormatOptions {...props} environmentfieldName="name" />
    }

    handleFormatHighlightedText = (opt: Environment, { inputValue }) => {
        return formatHighlightedTextDescription(opt, inputValue, 'name')
    }

    renderEnvNamespaceAndTriggerType() {
        const envId = this.state.pipelineConfig.environmentId
        const selectedEnv: Environment = this.state.environments.find((env) => env.id == envId)
        const namespaceEditable = false
        const envList = createClusterEnvGroup(this.state.environments, 'clusterName')

        const groupHeading = (props) => {
            return <GroupHeading {...props} />
        }

        const getNamespaceplaceholder = (): string => {
            if (this.state.pipelineConfig.isVirtualEnvironment) {
                if (this.state.pipelineConfig.namespace) {
                    return 'Will be auto-populated based on environment'
                }
                return 'Not available'
            }
            return 'Will be auto-populated based on environment'
        }

        const renderVirtualEnvironmentInfo = () => {
            if (this.state.pipelineConfig.isVirtualEnvironment && VirtualEnvSelectionInfoText) {
                return <VirtualEnvSelectionInfoText />
            }
        }

        return (
            <>
                <div className="form__row form__row--flex mt-12">
                    <div className="w-50 mr-8">
                        <div className="form__label dc__required-field">Environment</div>
                        <ReactSelect
                            menuPosition={this.state.isAdvanced ? null : 'fixed'}
                            closeMenuOnScroll
                            isDisabled={!!this.props.match.params.cdPipelineId}
                            classNamePrefix="cd-pipeline-environment-dropdown"
                            placeholder="Select Environment"
                            options={envList}
                            value={selectedEnv}
                            getOptionLabel={(option) => `${option.name}`}
                            getOptionValue={(option) => `${option.id}`}
                            isMulti={false}
                            onChange={(selected: any) => this.selectEnvironment(selected)}
                            components={{
                                IndicatorSeparator: null,
                                DropdownIndicator,
                                SingleValue: this.singleOption,
                                GroupHeading: groupHeading,
                            }}
                            styles={{
                                ...groupStyle(),
                                control: (base) => ({ ...base, border: '1px solid #d6dbdf' }),
                            }}
                            formatOptionLabel={this.handleFormatHighlightedText}
                        />
                        {!this.state.errorForm.envNameError.isValid ? (
                            <span className="form__error">
                                <img src={error} className="form__icon" />
                                {this.state.errorForm.envNameError.message}
                            </span>
                        ) : null}
                        {renderVirtualEnvironmentInfo()}
                    </div>
                    <div className="flex-1 ml-8">
                        <CustomInput
                            name="namespace"
                            label="Namespace"
                            placeholder={getNamespaceplaceholder()}
                            data-testid="cd-pipeline-namespace-textbox"
                            disabled={!namespaceEditable}
                            value={
                                selectedEnv && selectedEnv.namespace
                                    ? selectedEnv.namespace
                                    : this.state.pipelineConfig.namespace
                            }
                            onChange={(event) => {
                                this.handleNamespaceChange(event, selectedEnv)
                            }}
                            error={
                                !this.state.errorForm.nameSpaceError.isValid &&
                                !this.state.pipelineConfig.isVirtualEnvironment &&
                                this.state.errorForm.nameSpaceError.message
                            }
                        />
                    </div>
                </div>
                {this.renderNamespaceInfo(namespaceEditable)}
                {this.state.pipelineConfig.isVirtualEnvironment
                    ? HelmManifestPush && (
                          <HelmManifestPush
                              generatedHelmPushAction={this.state.generatedHelmPushAction}
                              onChangeSetGeneratedHelmPush={this.onChangeSetGeneratedHelmPush}
                              repositoryName={this.state.pipelineConfig.repoName}
                              handleOnRepository={this.setRepositoryName}
                              dockerRegistries={this.state.dockerRegistries}
                              handleRegistryChange={this.handleRegistryChange}
                              selectedRegistry={this.state.selectedRegistry}
                              containerRegistryName={this.state.pipelineConfig.containerRegistryName}
                              containerRegistryErrorForm={this.state.errorForm.containerRegistryError}
                              repositoryErrorForm={this.state.errorForm.repositoryError}
                          />
                      )
                    : this.renderTriggerType()}
                {this.state.pipelineConfig.isVirtualEnvironment &&
                    this.state.generatedHelmPushAction === GeneratedHelmPush.PUSH && (
                        <div className="mt-16">{this.renderTriggerType()}</div>
                    )}
            </>
        )
    }

    renderWebhookWarning() {
        return (
            <InfoColourBar
                message={
                    <div>
                        <span className="fw-6">Connecting to external CI service: </span>A webhook url and sample JSON
                        will be generated after the pipeline is created.
                    </div>
                }
                classname="bw-1 bcv-1 ev-2 bcv-1 fs-12 mt-20"
                Icon={Help}
                iconClass="fcv-5 h-20"
            />
        )
    }

    renderPipelineNameInput = () => {
        return (
            <div className="form__row">
                <CustomInput
                    name="pipelineName"
                    label="Pipeline Name"
                    disabled={!!this.state.pipelineConfig.id}
                    data-testid="advance-pipeline-name-textbox"
                    placeholder="Pipeline name"
                    isRequiredField
                    value={this.state.pipelineConfig.name}
                    onChange={this.handlePipelineName}
                    error={
                        !this.state.errorForm.pipelineNameError.isValid &&
                        this.state.errorForm.pipelineNameError.message
                    }
                />
            </div>
        )
    }

    toggleShowPreStage = () => {
        this.setState({ showPreStage: !this.state.showPreStage })
    }

    renderPreStage = () => {
        return (
            <>
                <div className="flex left" data-testid="pre-stage-dropdown" onClick={this.toggleShowPreStage}>
                    <div className="icon-dim-44 bcn-1 br-8 flex">
                        <PrePostCD className="icon-dim-24" />
                    </div>
                    <div className="ml-16 mr-16 flex-1">
                        <h4 className="fs-14 fw-6 lh-1-43 cn-9 mb-4">Pre-deployment Stage</h4>
                        <div className="form__label form__label--sentence m-0">
                            Configure actions like DB migration, that you want to run before the deployment.
                        </div>
                    </div>
                    <div className="icon-dim-44 flex">
                        <img
                            className="icon-dim-32 ml-auto"
                            src={dropdown}
                            alt="dropDown"
                            style={{ transform: this.state.showPreStage ? 'rotate(180deg)' : 'rotate(0)' }}
                        />
                    </div>
                </div>
                {this.state.showPreStage && this.renderDeploymentStageDetails('preStage')}
            </>
        )
    }

    toggelShowDeploymentStage = () => {
        this.setState({ showDeploymentStage: !this.state.showDeploymentStage })
    }

    renderDeploymentStage = () => {
        return (
            <>
                <div
                    className="flex left"
                    data-testid="deployment-stage-dropdown"
                    onClick={this.toggelShowDeploymentStage}
                >
                    <div className="icon-dim-44 bcn-1 br-8 flex">
                        {this.state.pipelineConfig.isVirtualEnvironment ? (
                            <Rocket className="icon-dim-24" />
                        ) : (
                            <CD className="icon-dim-24 dc__flip" />
                        )}
                    </div>
                    <div className="ml-16 mr-16 flex-1">
                        <h4 className="fs-14 fw-6 lh-1-43 cn-9 mb-4">Deployment Stage</h4>
                        <p className="form__label form__label--sentence m-0">
                            Configure deployment preferences for this pipeline.
                        </p>
                    </div>
                    <div className="icon-dim-44 flex">
                        <img
                            className="icon-dim-32 ml-auto"
                            src={dropdown}
                            alt="dropDown"
                            style={{ transform: this.state.showDeploymentStage ? 'rotate(180deg)' : 'rotate(0)' }}
                        />
                    </div>
                </div>
                {this.state.showDeploymentStage && (
                    <div className="ml-60">
                        {this.renderEnvNamespaceAndTriggerType()}
                        {!window._env_.HIDE_GITOPS_OR_HELM_OPTION &&
                            !this.state.pipelineConfig.isVirtualEnvironment &&
                            this.state.allowedDeploymentTypes.length > 0 &&
                            this.renderDeploymentAppType()}
                        {this.renderDeploymentStrategy()}
                    </div>
                )}
            </>
        )
    }

    toggleShowPostStage = () => {
        this.setState({ showPostStage: !this.state.showPostStage })
    }

    renderPostStage = () => {
        return (
            <>
                <div className="flex left" data-testid="post-stage-dropdown" onClick={this.toggleShowPostStage}>
                    <div className="icon-dim-44 bcn-1 br-8 flex">
                        <PrePostCD className="icon-dim-24" />
                    </div>
                    <div className="ml-16 mr-16 flex-1">
                        <h4 className="fs-14 fw-6 lh-1-43 cn-9 mb-4">Post-deployment Stage</h4>
                        <p className="form__label form__label--sentence m-0">
                            Configure actions like Jira ticket close, that you want to run after the deployment.
                        </p>
                    </div>
                    <div className="icon-dim-44 flex">
                        <img
                            className="icon-dim-32 ml-auto"
                            src={dropdown}
                            alt="dropDown"
                            style={{ transform: this.state.showPostStage ? 'rotate(180deg)' : 'rotate(0)' }}
                        />
                    </div>
                </div>
                {this.state.showPostStage && this.renderDeploymentStageDetails('postStage')}
            </>
        )
    }

    onChangeRequiredApprovals = (requiredCount: string): void => {
        this.setState({ requiredApprovals: requiredCount })
    }

    renderAdvancedCD() {
        return (
            <>
                {this.renderPipelineNameInput()}
                <div className="divider mt-12 mb-12" />
                {this.renderPreStage()}
                <div className="divider mt-12 mb-12" />
                {ManualApproval && (
                    <>
                        <ManualApproval
                            requiredApprovals={this.state.requiredApprovals}
                            currentRequiredCount={this.state.pipelineConfig.userApprovalConfig?.requiredCount}
                            onChangeRequiredApprovals={this.onChangeRequiredApprovals}
                        />
                        <div className="divider mt-12 mb-12" />
                    </>
                )}
                {this.renderDeploymentStage()}
                <div className="divider mt-12 mb-12" />
                {this.renderPostStage()}
                <div className="divider mt-12 mb-12" />
            </>
        )
    }

    renderBasicCD() {
        const strategyMenu = Object.keys(this.allStrategies).map((option) => {
            return { label: option, value: option }
        })
        const strategy = this.state.pipelineConfig.strategies[0]
            ? {
                  label: this.state.pipelineConfig.strategies[0]?.deploymentTemplate,
                  value: this.state.pipelineConfig.strategies[0]?.deploymentTemplate,
              }
            : undefined
        return (
            <>
                <p className="fs-14 fw-6 cn-9">Deploy to environment</p>
                {this.renderEnvNamespaceAndTriggerType()}
                {!window._env_.HIDE_GITOPS_OR_HELM_OPTION &&
                    !this.state.pipelineConfig.isVirtualEnvironment &&
                    this.state.allowedDeploymentTypes.length > 0 &&
                    this.renderDeploymentAppType()}
                {!this.noStrategyAvailable && (
                    <>
                        <p className="fs-14 fw-6 cn-9 mb-8 mt-20">Deployment Strategy</p>
                        <p className="fs-13 fw-5 cn-7 mb-8">Configure deployment preferences for this pipeline</p>
                        <ReactSelect
                            menuPosition="fixed"
                            closeMenuOnScroll
                            classNamePrefix="deployment-strategy-dropdown"
                            isSearchable={false}
                            isClearable={false}
                            isMulti={false}
                            placeholder="Select Strategy"
                            options={strategyMenu}
                            value={strategy}
                            onChange={(selected: any) => {
                                this.handleStrategy(selected.value)
                            }}
                            components={{
                                IndicatorSeparator: null,
                                DropdownIndicator,
                                Option,
                            }}
                            styles={{ ...styles }}
                        />
                    </>
                )}
                {this.isWebhookCD && !this.state.pipelineConfig.parentPipelineId && this.renderWebhookWarning()}
            </>
        )
    }

    renderCDPipelineBody() {
        if (this.state.view === ViewType.LOADING) {
            return <Progressing pageLoader />
        }
        if (this.state.view == ViewType.ERROR) {
            return <ErrorScreenManager code={this.state.code} />
        }
        if (this.state.isAdvanced) {
            return this.renderAdvancedCD()
        }
        return this.renderBasicCD()
    }

    renderCDPipelineModal() {
        return (
            <>
                <form
                    className={
                        this.props.match.params.cdPipelineId || this.state.isAdvanced
                            ? 'bcn-0'
                            : 'modal__body modal__body__ci_new_ui br-0 modal__body--p-0 bottom-border-radius'
                    }
                    onSubmit={this.savePipeline}
                >
                    {this.renderHeader()}
                    <div
                        className="cd-pipeline-body p-20"
                        style={{
                            height:
                                this.props.match.params.cdPipelineId || this.state.isAdvanced
                                    ? 'calc(100vh - 125px)'
                                    : 'auto',
                            maxHeight:
                                this.props.match.params.cdPipelineId || this.state.isAdvanced
                                    ? 'auto'
                                    : 'calc(100vh - 164px)',
                            overflowY: 'scroll',
                        }}
                    >
                        {this.renderCDPipelineBody()}
                    </div>

                    <div
                        className={`ci-button-container bcn-0 pt-12 pb-12 pl-20 pr-20 flex bottom-border-radius ${
                            this.isWebhookCD && !this.props.match.params.cdPipelineId ? 'right' : 'flex-justify'
                        }`}
                    >
                        {this.renderSecondaryButton()}
                        <ButtonWithLoader
                            rootClassName="cta cta--workflow"
                            dataTestId="create-update-pipeline-button"
                            onClick={this.savePipeline}
                            isLoading={this.state.loadingData}
                            loaderColor="white"
                        >
                            {this.props.match.params.cdPipelineId ? 'Update Pipeline' : 'Create Pipeline'}
                        </ButtonWithLoader>
                    </div>
                </form>
                {this.renderDeleteCDModal()}
            </>
        )
    }

    render() {
        return this.props.match.params.cdPipelineId || this.state.isAdvanced ? (
            <Drawer position="right" width="75%" minWidth="1024px" maxWidth="1200px">
                {this.renderCDPipelineModal()}
            </Drawer>
        ) : (
            <VisibleModal className="">{this.renderCDPipelineModal()}</VisibleModal>
        )
    }
}
