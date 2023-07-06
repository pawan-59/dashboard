import { BuildStageVariable, ConditionalWrap, ConditionType, DeleteDialog, Drawer, ForceDeleteDialog, FormErrorObjectType, MandatoryPluginDataType, MandatoryPluginDetailType, PluginDetailType, PluginType, RefVariableStageType, RefVariableType, ScriptType, ServerErrors, showError, StepType, TaskErrorObj, VariableType, VisibleModal } from '@devtron-labs/devtron-fe-common-lib'
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ReactComponent as Close } from '../../assets/icons/ic-close.svg'
import { NavLink, Redirect, Route, Switch, useLocation, useParams, useRouteMatch } from 'react-router-dom'
import { BuildTabText, DELETE_ACTION, SourceTypeMap, TriggerType, ViewType } from '../../config'
import { ButtonWithLoader, importComponentFromFELibrary, sortObjectArrayAlphabetically } from '../common'
import BuildCD from './BuildCD'
import { CDFormType, CD_PATCH_ACTION, Environment } from './cdPipeline.types'
import { deleteCDPipeline, getCDPipelineConfig, getCDPipelineNameSuggestion, getConfigMapAndSecrets, getDeploymentStrategyList, saveCDPipeline, updateCDPipeline } from './cdPipeline.service'
import { getEnvironmentListMinPublic } from '../../services/service'
import yamlJsParser from 'yaml'
import { Sidebar } from '../CIPipelineN/Sidebar'
import { PreBuild } from '../CIPipelineN/PreBuild'
import { getGlobalVariable, getPluginsData } from '../ciPipeline/ciPipeline.service'
import { ValidationRules } from '../ciPipeline/validationRules'
import { ReactComponent as WarningTriangle } from '../../assets/icons/ic-warning.svg'
import { pipelineContext } from '../workflowEditor/workflowEditor'
import './cdPipeline.scss'
import { toast } from 'react-toastify'
import { MULTI_REQUIRED_FIELDS_MSG, TOAST_INFO } from '../../config/constantMessaging'
import { PipelineType } from '../app/details/triggerView/types'
import { DeploymentAppType } from '../v2/values/chartValuesDiff/ChartValuesView.type'
import Tippy from '@tippyjs/react'
import ClusterNotReachableDailog from '../common/ClusterNotReachableDailog/ClusterNotReachableDialog'

const validatePlugins = importComponentFromFELibrary('validatePlugins', null, 'function')

export enum deleteDialogType {
    showForceDeleteDialog = 'showForceDeleteDialog',
    showNonCascadeDeleteDialog = 'showNonCascadeDeleteDialog',
    showNormalDeleteDialog = 'showNormalDeleteDialog',
}

export default function NewCDPipeline({
    match,
    history,
    location,
    appName,
    close,
    downstreamNodeSize,
    getWorkflows,
    refreshParentWorkflows,
}) {
    const isCdPipeline = true
    const urlParams = new URLSearchParams(location.search)
    const validationRules = new ValidationRules()
    const isWebhookCD = window.location.href.includes('webhook')
    const allStrategies = useRef<{ [key: string]: any }>({})
    const noStrategyAvailable = useRef(false)
    const parentPipelineTypeFromURL = urlParams.get('parentPipelineType')
    const parentPipelineId = urlParams.get('parentPipelineId')

    let { appId, workflowId, ciPipelineId, cdPipelineId } = useParams<{
        appId: string
        workflowId: string
        ciPipelineId: string
        cdPipelineId?: string
    }>()
    if (cdPipelineId === '0') {
        cdPipelineId = null
    }
    let activeStageName = BuildStageVariable.Build
    if (location.pathname.indexOf('/pre-build') >= 0) {
        activeStageName = BuildStageVariable.PreBuild
    } else if (location.pathname.indexOf('/post-build') >= 0) {
        activeStageName = BuildStageVariable.PostBuild
    }
    const title = `${cdPipelineId ? 'Edit ' : 'Create '}pipeline`
    const text = cdPipelineId ? 'Update Pipeline' : 'Create Pipeline'
    const [formData, setFormData] = useState<CDFormType>({
        name: '',
        ciPipelineId: isWebhookCD ? 0 : +ciPipelineId,
        environmentId: 0,
        environments: [],
        environmentName: '',
        namespace: '',
        deploymentAppType: window._env_.HIDE_GITOPS_OR_HELM_OPTION ? '' : DeploymentAppType.Helm,
        triggerType: TriggerType.Auto,
        strategies: [],
        savedStrategies: [],
        preStageConfigMapSecretNames: { configMaps: [], secrets: [] },
        postStageConfigMapSecretNames: { configMaps: [], secrets: [] },
        preBuildStage: {
            id: 0,
            triggerType: TriggerType.Auto,
            steps: [],
        },
        postBuildStage: {
            id: 0,
            triggerType: TriggerType.Auto,
            steps: [],
        },
        requiredApprovals: '',
        userApprovalConfig: null,
        isClusterCdActive: false,
        deploymentAppCreated: false,
        clusterName: '',
        runPreStageInEnv: false,
        runPostStageInEnv: false,
    })
    const [configMapAndSecrets, setConfigMapAndSecrets] = useState([])
    const [presetPlugins, setPresetPlugins] = useState<PluginDetailType[]>([])
    const [sharedPlugins, setSharedPlugins] = useState<PluginDetailType[]>([])
    const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0)
    const [showFormError, setShowFormError] = useState<boolean>(false)
    const [configurationType, setConfigurationType] = useState<string>('GUI')
    const [globalVariables, setGlobalVariables] = useState<{ label: string; value: string; format: string }[]>([])
    const [loadingData, setLoadingData] = useState<boolean>(false)
    const [mandatoryPluginData, setMandatoryPluginData] = useState<MandatoryPluginDataType>(null)
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
    const mandatoryPluginsMap: Record<number, MandatoryPluginDetailType> = useMemo(() => {
        const _mandatoryPluginsMap: Record<number, MandatoryPluginDetailType> = {}
        if (mandatoryPluginData?.pluginData.length) {
            for (const plugin of mandatoryPluginData.pluginData) {
                _mandatoryPluginsMap[plugin.id] = plugin
            }
        }
        return _mandatoryPluginsMap
    }, [mandatoryPluginData])
    const [deleteDialog, setDeleteDialog] = useState<deleteDialogType>(deleteDialogType.showNormalDeleteDialog)
    const [forceDeleteData, setForceDeleteData] = useState({forceDeleteDialogMessage: '', forceDeleteDialogTitle: ''})
    const { path } = useRouteMatch()
    const [pageState, setPageState] = useState(ViewType.LOADING)
    const [isVirtualEnvironment, setIsVirtualEnvironment] = useState<boolean>()
    const [isAdvanced, setIsAdvanced] = useState<boolean>(false)
    const parentPipelineType = parentPipelineTypeFromURL
        ? parentPipelineTypeFromURL.toLocaleUpperCase().replace('-', '_')
        : isWebhookCD
        ? SourceTypeMap.WEBHOOK
        : ''

    const [formDataErrorObj, setFormDataErrorObj] = useState({
        name: { isValid: true },
        envNameError: { isValid: true },
        nameSpaceError: { isValid: true },
        preBuildStage: {
            steps: [],
            isValid: true,
        },
        buildStage: {
            isValid: true,
        },
        postBuildStage: {
            steps: [],
            isValid: true,
        },
    })
    const [inputVariablesListFromPrevStep, setInputVariablesListFromPrevStep] = useState<{
        preBuildStage: Map<string, VariableType>[]
        postBuildStage: Map<string, VariableType>[]
    }>({ preBuildStage: [], postBuildStage: [] })
    

    useEffect(() => {
        getDeploymentStrategies()
        getGlobalVariables()
        document.addEventListener('keydown', escFunction)
    }, [])

    useEffect(() => {
        if(formData.environmentId){
            getConfigMapSecrets()
        }
    },[formData.environmentId])

    const escFunction = (event) => {
        if ((event.keyCode === 27 || event.key === 'Escape') && typeof close === 'function') {
            close()
        }
    }
    const getDeploymentStrategies = (): void => {
        getDeploymentStrategyList(appId)
            .then((response) => {
                let strategies = response.result.pipelineStrategy || []
                const _allStrategies = {}

                strategies.forEach((strategy) => {
                    if (!_allStrategies[strategy.deploymentTemplate]) {
                        _allStrategies[strategy.deploymentTemplate] = {}
                    }
                    _allStrategies[strategy.deploymentTemplate] = strategy.config
                })
                allStrategies.current = _allStrategies
                noStrategyAvailable.current = strategies.length === 0

                const _form = { ...formData }
                _form.strategies = strategies
                getAvailablePlugins()
                if (cdPipelineId) {
                    getCDPipeline(_form)
                } else {
                    getEnvCDPipelineName(_form)
                    if (strategies.length > 0) {
                        let defaultStrategy = strategies.find((strategy) => strategy.default)
                        handleStrategy(defaultStrategy.deploymentTemplate)
                    }
                }
            })
            .catch((error: ServerErrors) => {
                showError(error)
                setPageState(ViewType.ERROR)
            })
    }

    const getEnvCDPipelineName = (form) => {
        Promise.all([getCDPipelineNameSuggestion(appId), getEnvironmentListMinPublic()]).then(
            ([cpPipelineName, envList]) => {
                form.name = cpPipelineName.result
                let list = envList.result || []
                list = list.map((env) => {
                    return {
                        id: env.id,
                        clusterName: env.cluster_name,
                        name: env.environment_name,
                        namespace: env.namespace || '',
                        active: false,
                        isClusterCdActive: env.isClusterCdActive,
                        description: env.description,
                        isVirtualEnvironment: env.isVirtualEnvironment, //Virtual environment is valid for virtual cluster on selection of environment
                    }
                })
                sortObjectArrayAlphabetically(list, 'name')
                form.environments = list
                setFormData(form)
                setPageState(ViewType.FORM)
                setIsAdvanced(false)
            },
        ).catch((error) => {
            showError(error)
        })
    }

    const getCDPipeline = (form): void => {
        getCDPipelineConfig(appId, cdPipelineId)
            .then((result) => {
                let pipelineConfigFromRes = result.pipelineConfig
                updateStateFromResponse(pipelineConfigFromRes, result.environments, form)
                const preBuildVariable = calculateLastStepDetail(
                    false,
                    result.form,
                    BuildStageVariable.PreBuild,
                ).calculatedStageVariables
                const postBuildVariable = calculateLastStepDetail(
                    false,
                    result.form,
                    BuildStageVariable.PostBuild,
                ).calculatedStageVariables
                setInputVariablesListFromPrevStep({
                    preBuildStage: preBuildVariable,
                    postBuildStage: postBuildVariable,
                })
                validateStage(BuildStageVariable.PreBuild, result.form)
                validateStage(BuildStageVariable.Build, result.form)
                validateStage(BuildStageVariable.PostBuild, result.form)
                setIsAdvanced(true)
                setFormData(form)
                setPageState(ViewType.FORM)
            })
            .catch((error: ServerErrors) => {
                showError(error)
                // this.setState({ code: error.code, view: ViewType.ERROR, loadingData: false })
            })
    }

    const getConfigMapSecrets = () => {
        getConfigMapAndSecrets(appId, formData.environmentId)
                .then((response) => {
                    setConfigMapAndSecrets(response.list)
                })
                .catch((error: ServerErrors) => {
                    showError(error)
                })
    }

    const getAvailablePlugins = (): void => {
        getPluginsData(Number(appId))
            .then((response) => {
                const _presetPlugin = []
                const _sharedPlugin = []
                const pluginListLength = response?.result?.length || 0
                for (let i = 0; i < pluginListLength; i++) {
                    const pluginData = response.result[i]
                    if (pluginData.type === 'PRESET') {
                        _presetPlugin.push(pluginData)
                    } else {
                        _sharedPlugin.push(pluginData)
                    }
                }
                setPresetPlugins(_presetPlugin)
                setSharedPlugins(_sharedPlugin)
            })
            .catch((error: ServerErrors) => {
                showError(error)
            })
    }

    const getGlobalVariables = (): void => {
        getGlobalVariable(Number(appId))
            .then((response) => {
                const _globalVariableOptions = response.result.map((variable) => {
                    variable.label = variable.name
                    variable.value = variable.name
                    variable.format = variable.format
                    variable.description = variable.description || ''
                    variable.variableType = RefVariableType.GLOBAL
                    delete variable.name
                    return variable
                })
                setGlobalVariables(_globalVariableOptions || [])
            })
            .catch((error: ServerErrors) => {
                showError(error)
            })
    }

    const getPrePostStageInEnv = (isVirtualEnvironment: boolean, isRunPrePostStageInEnv: boolean): boolean => {
        if (isVirtualEnvironment) {
            return true
        } else {
            return isRunPrePostStageInEnv ?? false
        }
    }

    const updateStateFromResponse = (pipelineConfigFromRes, environments, form): void => {
        sortObjectArrayAlphabetically(environments, 'name')
        environments = environments.map((env) => {
            return {
                ...env,
                active: env.id === pipelineConfigFromRes.environmentId,
            }
        })
        let savedStrategies = []
        if (pipelineConfigFromRes.strategies) {
            for (let i = 0; i < pipelineConfigFromRes.strategies.length; i++) {
                savedStrategies.push({
                    ...pipelineConfigFromRes.strategies[i],
                    defaultConfig: allStrategies.current[pipelineConfigFromRes.strategies[i].deploymentTemplate],
                    jsonStr: JSON.stringify(pipelineConfigFromRes.strategies[i].config, null, 4),
                    selection: yamlJsParser.stringify(allStrategies.current[pipelineConfigFromRes.strategies[i].config], {
                        indent: 2,
                    }),
                    isCollapsed: true,
                })
                form.strategies = form.strategies.filter(
                    (strategy) =>
                        strategy.deploymentTemplate !== pipelineConfigFromRes.strategies[i].deploymentTemplate,
                )
            }
        }
        let env = environments.find((e) => e.id === pipelineConfigFromRes.environmentId)

        form.name = pipelineConfigFromRes.name
        form.environmentName = pipelineConfigFromRes.environmentName || ''
        form.namespace = env.namespace
        form.environmentId = pipelineConfigFromRes.environmentId
        form.environments = environments
        form.savedStrategies = savedStrategies 
        form.isClusterCdActive = pipelineConfigFromRes.isClusterCdActive || false
        form.deploymentAppType = pipelineConfigFromRes.deploymentAppType || ''
        form.deploymentAppCreated = pipelineConfigFromRes.deploymentAppCreated || false
        form.triggerType = pipelineConfigFromRes.triggerType || TriggerType.Auto
        if(pipelineConfigFromRes?.preDeployStage){
            form.preBuildStage = pipelineConfigFromRes.preDeployStage   
        }   
        if(pipelineConfigFromRes?.postDeployStage){
            form.postBuildStage = pipelineConfigFromRes?.postDeployStage
        }
        form.requiredApprovals = `${pipelineConfigFromRes.userApprovalConfig?.requiredCount || ''}`
        form.preStageConfigMapSecretNames = {
            configMaps: pipelineConfigFromRes.preStageConfigMapSecretNames.configMaps
                ? pipelineConfigFromRes.preStageConfigMapSecretNames.configMaps.map((configmap) => {
                    return {
                        label: configmap,
                        value: configmap,
                        type: 'configmaps'
                    }
                })
                : [],
            secrets: pipelineConfigFromRes.preStageConfigMapSecretNames.secrets
                ? pipelineConfigFromRes.preStageConfigMapSecretNames.secrets.map((secret) => {
                    return {
                        label: secret,
                        value: secret,
                        type: 'secrets'
                    }
                })
                : [],
        }
        form.postStageConfigMapSecretNames = {
            configMaps: pipelineConfigFromRes.postStageConfigMapSecretNames.configMaps
                ? pipelineConfigFromRes.postStageConfigMapSecretNames.configMaps.map((configmap) => {
                    return {
                        label: configmap,
                        value: configmap,
                        type: 'configmaps'
                    }
                })
                : [],
            secrets: pipelineConfigFromRes.postStageConfigMapSecretNames.secrets
                ? pipelineConfigFromRes.postStageConfigMapSecretNames.secrets.map((secret) => {
                    return {
                        label: secret,
                        value: secret,
                        type: 'secrets'
                    }
                })
                : [],
        }
        form.runPreStageInEnv = getPrePostStageInEnv(isVirtualEnvironment, pipelineConfigFromRes.runPreStageInEnv)
        form.runPostStageInEnv = getPrePostStageInEnv(isVirtualEnvironment, pipelineConfigFromRes.runPostStageInEnv)  
    }

    const validateTask = (taskData: StepType, taskErrorObj: TaskErrorObj): void => {
        if (taskData && taskErrorObj) {
            taskErrorObj.name = validationRules.requiredField(taskData.name)
            taskErrorObj.isValid = taskErrorObj.name.isValid

            if (taskData.stepType) {
                const inputVarMap: Map<string, boolean> = new Map()
                const outputVarMap: Map<string, boolean> = new Map()
                const currentStepTypeVariable =
                    taskData.stepType === PluginType.INLINE ? 'inlineStepDetail' : 'pluginRefStepDetail'
                taskErrorObj[currentStepTypeVariable].inputVariables = []
                taskData[currentStepTypeVariable].inputVariables?.forEach((element, index) => {
                    taskErrorObj[currentStepTypeVariable].inputVariables.push(
                        validationRules.inputVariable(element, inputVarMap),
                    )
                    taskErrorObj.isValid =
                        taskErrorObj.isValid && taskErrorObj[currentStepTypeVariable].inputVariables[index].isValid
                    inputVarMap.set(element.name, true)
                })
                if (taskData.stepType === PluginType.INLINE) {
                    taskErrorObj.inlineStepDetail.outputVariables = []
                    taskData.inlineStepDetail.outputVariables?.forEach((element, index) => {
                        taskErrorObj.inlineStepDetail.outputVariables.push(
                            validationRules.outputVariable(element, outputVarMap),
                        )
                        taskErrorObj.isValid =
                            taskErrorObj.isValid && taskErrorObj.inlineStepDetail.outputVariables[index].isValid
                        outputVarMap.set(element.name, true)
                    })
                    if (taskData.inlineStepDetail['scriptType'] === ScriptType.SHELL) {
                        taskErrorObj.inlineStepDetail['script'] = validationRules.requiredField(
                            taskData.inlineStepDetail['script'],
                        )
                        taskErrorObj.isValid = taskErrorObj.isValid && taskErrorObj.inlineStepDetail['script'].isValid
                    } else if (taskData.inlineStepDetail['scriptType'] === ScriptType.CONTAINERIMAGE) {
                        // For removing empty mapping from portMap
                        taskData.inlineStepDetail['portMap'] =
                            taskData.inlineStepDetail['portMap']?.filter(
                                (_port) => _port.portOnLocal && _port.portOnContainer,
                            ) || []
                        if (taskData.inlineStepDetail['isMountCustomScript']) {
                            taskErrorObj.inlineStepDetail['script'] = validationRules.requiredField(
                                taskData.inlineStepDetail['script'],
                            )
                            taskErrorObj.inlineStepDetail['storeScriptAt'] = validationRules.requiredField(
                                taskData.inlineStepDetail['storeScriptAt'],
                            )
                            taskErrorObj.isValid =
                                taskErrorObj.isValid &&
                                taskErrorObj.inlineStepDetail['script'].isValid &&
                                taskErrorObj.inlineStepDetail['storeScriptAt'].isValid
                        }

                        taskErrorObj.inlineStepDetail['containerImagePath'] = validationRules.requiredField(
                            taskData.inlineStepDetail['containerImagePath'],
                        )
                        taskErrorObj.isValid =
                            taskErrorObj.isValid && taskErrorObj.inlineStepDetail['containerImagePath'].isValid

                        if (taskData.inlineStepDetail['mountCodeToContainer']) {
                            taskErrorObj.inlineStepDetail['mountCodeToContainerPath'] = validationRules.requiredField(
                                taskData.inlineStepDetail['mountCodeToContainerPath'],
                            )
                            taskErrorObj.isValid =
                                taskErrorObj.isValid &&
                                taskErrorObj.inlineStepDetail['mountCodeToContainerPath'].isValid
                        }

                        if (taskData.inlineStepDetail['mountDirectoryFromHost']) {
                            taskErrorObj.inlineStepDetail['mountPathMap'] = []
                            taskData.inlineStepDetail['mountPathMap']?.forEach((element, index) => {
                                taskErrorObj.inlineStepDetail['mountPathMap'].push(
                                    validationRules.mountPathMap(element),
                                )
                                taskErrorObj.isValid =
                                    taskErrorObj.isValid && taskErrorObj.inlineStepDetail['mountPathMap'][index].isValid
                            })
                        }
                    }
                } else {
                    taskData.pluginRefStepDetail.outputVariables?.forEach((element, index) => {
                        outputVarMap.set(element.name, true)
                    })
                }

                taskErrorObj[currentStepTypeVariable]['conditionDetails'] = []
                taskData[currentStepTypeVariable].conditionDetails?.forEach((element, index) => {
                    if (element.conditionOnVariable) {
                        if (
                            ((element.conditionType === ConditionType.FAIL ||
                                element.conditionType === ConditionType.PASS) &&
                                !outputVarMap.get(element.conditionOnVariable)) ||
                            ((element.conditionType === ConditionType.TRIGGER ||
                                element.conditionType === ConditionType.SKIP) &&
                                !inputVarMap.get(element.conditionOnVariable))
                        ) {
                            element.conditionOnVariable = ''
                        }
                    }
                    taskErrorObj[currentStepTypeVariable]['conditionDetails'].push(
                        validationRules.conditionDetail(element),
                    )
                    taskErrorObj.isValid =
                        taskErrorObj.isValid && taskErrorObj[currentStepTypeVariable]['conditionDetails'][index].isValid
                })
            }
        }
    }

    const responseCode = () => {
        
        const _preStageConfigMapSecretNames = {
            configMaps: formData.preStageConfigMapSecretNames.configMaps.map((config) => {
                return config['value']
            }),
            secrets: formData.preStageConfigMapSecretNames.secrets.map((secret) => {
                return secret['value']
            }),
        }

        const _postStageConfigMapSecretNames = {
            configMaps: formData.postStageConfigMapSecretNames.configMaps.map((config) => {
                return config['value']
            }),
            secrets: formData.postStageConfigMapSecretNames.secrets.map((secret) => {
                return secret['value']
            }),
        }
    
        const pipeline = {
            name: formData.name,
            appWorkflowId: +workflowId,
            ciPipelineId: +ciPipelineId,
            environmentId: formData.environmentId,
            namespace: formData.namespace,
            id: +cdPipelineId,
            strategies: formData.savedStrategies,
            parentPipelineType: parentPipelineType,
            parentPipelineId: +parentPipelineId,
            isClusterCdActive: formData.isClusterCdActive,
            deploymentAppType: formData.deploymentAppType,
            deploymentAppCreated: formData.deploymentAppCreated,
            userApprovalConfig: formData.userApprovalConfig,
            triggerType: formData.triggerType,
            environmentName: formData.environmentName,
            preStageConfigMapSecretNames: _preStageConfigMapSecretNames,
            postStageConfigMapSecretNames: _postStageConfigMapSecretNames,
        }
      
        const request = {
            appId: +appId
        }
        if (!cdPipelineId) {
            request['pipelines'] = [pipeline]
        } else {
            request['pipeline'] = pipeline
            request['action'] = CD_PATCH_ACTION.UPDATE
        }

        if(formData.preBuildStage.steps.length > 0){
            pipeline['preDeployStage'] = formData.preBuildStage
        }
        if(formData.postBuildStage.steps.length > 0){
            pipeline['postDeployStage'] = formData.postBuildStage
        }

        return request
    }

    const addNewTask = () => {
        const _formData = { ...formData }
        const detailsFromLastStep = calculateLastStepDetail(true, _formData, activeStageName)

        const stage = {
            id: detailsFromLastStep.index,
            index: detailsFromLastStep.index,
            name: `Task ${detailsFromLastStep.index}`,
            description: '',
            stepType: '',
            directoryPath: '',
        }
        _formData[activeStageName].steps.push(stage)
        setFormData(_formData)
        const _formDataErrorObj = { ...formDataErrorObj }
        _formDataErrorObj[activeStageName].steps.push({
            name: { isValid: true, message: null },
            isValid: true,
        })
        setFormDataErrorObj(_formDataErrorObj)
        setSelectedTaskIndex(_formData[activeStageName].steps.length - 1)
    }

    const calculateLastStepDetail = (
        isFromAddNewTask: boolean,
        _formData: CDFormType,
        activeStageName: string,
        startIndex?: number,
        isFromMoveTask?: boolean,
    ): {
        index: number
        calculatedStageVariables: Map<string, VariableType>[]
    } => {
        const _formDataErrorObj = { ...formDataErrorObj }
        if (!_formData[activeStageName].steps) {
            _formData[activeStageName].steps = []
        }
        const stepsLength = _formData[activeStageName].steps?.length
        let _outputVariablesFromPrevSteps: Map<string, VariableType> = new Map(),
            _inputVariablesListPerTask: Map<string, VariableType>[] = []
        for (let i = 0; i < stepsLength; i++) {
            if (!_formDataErrorObj[activeStageName].steps[i])
                _formDataErrorObj[activeStageName].steps.push({ isValid: true })
            _inputVariablesListPerTask.push(new Map(_outputVariablesFromPrevSteps))
            _formData[activeStageName].steps[i].index = i + 1
            if (!_formData[activeStageName].steps[i].stepType) {
                continue
            }

            if (
                _formData[activeStageName].steps[i].stepType === PluginType.INLINE &&
                _formData[activeStageName].steps[i].inlineStepDetail.scriptType === ScriptType.CONTAINERIMAGE &&
                _formData[activeStageName].steps[i].inlineStepDetail.script &&
                !_formData[activeStageName].steps[i].inlineStepDetail.isMountCustomScript
            ) {
                _formData[activeStageName].steps[i].inlineStepDetail.isMountCustomScript = true
            }
            const currentStepTypeVariable =
                _formData[activeStageName].steps[i].stepType === PluginType.INLINE
                    ? 'inlineStepDetail'
                    : 'pluginRefStepDetail'
            if (!_formDataErrorObj[activeStageName].steps[i][currentStepTypeVariable]) {
                _formDataErrorObj[activeStageName].steps[i][currentStepTypeVariable] = {
                    inputVariables: [],
                    outputVariables: [],
                }
            }
            if (!_formDataErrorObj[activeStageName].steps[i][currentStepTypeVariable].inputVariables) {
                _formDataErrorObj[activeStageName].steps[i][currentStepTypeVariable].inputVariables = []
            }
            if (!_formDataErrorObj[activeStageName].steps[i][currentStepTypeVariable].outputVariables) {
                _formDataErrorObj[activeStageName].steps[i][currentStepTypeVariable].outputVariables = []
            }
            const outputVariablesLength =
                _formData[activeStageName].steps[i][currentStepTypeVariable].outputVariables?.length
            for (let j = 0; j < outputVariablesLength; j++) {
                if (_formData[activeStageName].steps[i][currentStepTypeVariable].outputVariables[j].name) {
                    _outputVariablesFromPrevSteps.set(
                        i +
                            1 +
                            '.' +
                            _formData[activeStageName].steps[i][currentStepTypeVariable].outputVariables[j].name,
                        {
                            ..._formData[activeStageName].steps[i][currentStepTypeVariable].outputVariables[j],
                            refVariableStepIndex: i + 1,
                            refVariableStage:
                                activeStageName === BuildStageVariable.PreBuild
                                    ? RefVariableStageType.PRE_CI
                                    : RefVariableStageType.POST_CI,
                        },
                    )
                }
            }
            if (
                !isFromAddNewTask &&
                i >= startIndex &&
                _formData[activeStageName].steps[i][currentStepTypeVariable].inputVariables
            ) {
                for (const key in _formData[activeStageName].steps[i][currentStepTypeVariable].inputVariables) {
                    const variableDetail =
                        _formData[activeStageName].steps[i][currentStepTypeVariable].inputVariables[key]
                    if (
                        variableDetail.variableType === RefVariableType.FROM_PREVIOUS_STEP &&
                        ((variableDetail.refVariableStage ===
                            (activeStageName === BuildStageVariable.PreBuild
                                ? RefVariableStageType.PRE_CI
                                : RefVariableStageType.POST_CI) &&
                            variableDetail.refVariableStepIndex > startIndex) ||
                            (activeStageName === BuildStageVariable.PreBuild &&
                                variableDetail.refVariableStage === RefVariableStageType.POST_CI))
                    ) {
                        variableDetail.refVariableStepIndex = 0
                        variableDetail.refVariableName = ''
                        variableDetail.variableType = RefVariableType.NEW
                        delete variableDetail.refVariableStage
                    }
                }
            }
        }
        if (isFromAddNewTask || isFromMoveTask) {
            _inputVariablesListPerTask.push(new Map(_outputVariablesFromPrevSteps))
        }
        const _inputVariablesListFromPrevStep = { ...inputVariablesListFromPrevStep }
        _inputVariablesListFromPrevStep[activeStageName] = _inputVariablesListPerTask
        setInputVariablesListFromPrevStep(_inputVariablesListFromPrevStep)
        setFormDataErrorObj(_formDataErrorObj)
        return { index: stepsLength + 1, calculatedStageVariables: _inputVariablesListPerTask }
    }

    const handleStrategy = (value: string): void => {
        let newSelection
        newSelection = {}
        newSelection['deploymentTemplate'] = value
        newSelection['defaultConfig'] = allStrategies.current[value]
        newSelection['config'] = allStrategies.current[value]
        newSelection['isCollapsed'] = true
        newSelection['default'] = true
        newSelection['jsonStr'] = JSON.stringify(allStrategies.current[value], null, 4)
        newSelection['yamlStr'] = yamlJsParser.stringify(allStrategies.current[value], { indent: 2 })

        const _form = {...formData}
        _form.savedStrategies.push(newSelection)
        _form.savedStrategies = [newSelection]
        setFormData(_form)
    }

    const validateStage = (stageName: string, _formData: CDFormType, formDataErrorObject?): void => {
        const _formDataErrorObj = {
            ...(formDataErrorObject ?? formDataErrorObj),
            name: validationRules.name(_formData.name),
            envNameError: validationRules.environment(_formData.environmentId)
        } // validating name always as it's a mandatory field
        if (stageName === BuildStageVariable.Build) {
            _formDataErrorObj[BuildStageVariable.Build].isValid = _formDataErrorObj.name.isValid && _formDataErrorObj.envNameError.isValid
            if (!_formDataErrorObj[BuildStageVariable.Build].isValid) {
                setShowFormError(true)
            }
        } else {
            const stepsLength = _formData[stageName].steps.length
            let isStageValid = true
            for (let i = 0; i < stepsLength; i++) {
                if (!_formDataErrorObj[stageName].steps[i]) _formDataErrorObj[stageName].steps.push({ isValid: true })
                validateTask(_formData[stageName].steps[i], _formDataErrorObj[stageName].steps[i])
                isStageValid = isStageValid && _formDataErrorObj[stageName].steps[i].isValid
            }
            
            _formDataErrorObj[stageName].isValid = isStageValid
        }
        setFormDataErrorObj(_formDataErrorObj)
    }

    const checkUniqueness = (): boolean => {
        const list = formData.preBuildStage.steps.concat(formData.postBuildStage.steps)
        const stageNameList = list.map((taskData) => {
            if (taskData.stepType === PluginType.INLINE) {
                if (taskData.inlineStepDetail['scriptType'] === ScriptType.CONTAINERIMAGE) {
                    if (!taskData.inlineStepDetail['isMountCustomScript']) {
                        taskData.inlineStepDetail['script'] = null
                        taskData.inlineStepDetail['storeScriptAt'] = null
                    }

                    if (!taskData.inlineStepDetail['mountCodeToContainer']) {
                        taskData.inlineStepDetail['mountCodeToContainerPath'] = null
                    }

                    if (!taskData.inlineStepDetail['mountDirectoryFromHost']) {
                        taskData.inlineStepDetail['mountPathMap'] = null
                    }
                    taskData.inlineStepDetail.outputVariables = null
                    let conditionDetails = taskData.inlineStepDetail.conditionDetails
                    for (let i = 0; i < conditionDetails?.length; i++) {
                        if (
                            conditionDetails[i].conditionType === ConditionType.PASS ||
                            conditionDetails[i].conditionType === ConditionType.FAIL
                        ) {
                            conditionDetails.splice(i, 1)
                            i--
                        }
                    }
                    taskData.inlineStepDetail.conditionDetails = conditionDetails
                }
            }
            return taskData.name
        })

        // Below code is to check if all the task name from pre-stage and post-stage is unique
        return stageNameList.length === new Set(stageNameList).size
    }

    const savePipeline = () => {
        const isUnique = checkUniqueness()
        if (!isUnique) {
            toast.error('All task names must be unique')
            return
        }
        setLoadingData(true)
        validateStage(BuildStageVariable.PreBuild, formData)
        validateStage(BuildStageVariable.Build, formData)
        validateStage(BuildStageVariable.PostBuild, formData)

        if (
            !formDataErrorObj.buildStage.isValid ||
            !formDataErrorObj.preBuildStage.isValid ||
            !formDataErrorObj.postBuildStage.isValid
        ) {
            setLoadingData(false)
            if (formData.name === '') {
                toast.error(MULTI_REQUIRED_FIELDS_MSG)
            }
            return
        }

       const request = responseCode()

        const _form = {...formData}
        let promise = cdPipelineId ? updateCDPipeline(request) : saveCDPipeline(request)
        promise
            .then((response) => {
                if (response.result) {
                    let pipelineConfigFromRes = response.result.pipelines[0]
                    updateStateFromResponse(pipelineConfigFromRes, _form.environments, _form)
                    let envName = pipelineConfigFromRes.environmentName
                    if (!envName) {
                        let selectedEnv: Environment = _form.environments.find(
                            (env) => env.id == _form.environmentId,
                        )
                        envName = selectedEnv.name
                    }
                    setFormData(_form)
                    close(
                        pipelineConfigFromRes.parentPipelineType !== PipelineType.WEBHOOK,
                        _form.environmentId,
                        envName,
                        pipelineConfigFromRes.cdPipelineId
                            ? 'Deployment pipeline updated'
                            : 'Deployment pipeline created',
                        !match.params.cdPipelineId,
                    )
                    getWorkflows()
                }
            })
            .catch((error: ServerErrors) => {
                showError(error)
            })
    }

    const hideDeleteModal = () => {
        setShowDeleteModal(false)
    }

    const setForceDeleteDialogData = (serverError) => {
        const _forceDeleteData = {...forceDeleteData}
        setDeleteDialog(deleteDialogType.showForceDeleteDialog)
        if (serverError instanceof ServerErrors && Array.isArray(serverError.errors)) {
            serverError.errors.map(({ userMessage, internalMessage }) => {
                _forceDeleteData.forceDeleteDialogMessage = internalMessage
                _forceDeleteData.forceDeleteDialogTitle = userMessage })
        }
        setForceDeleteData(_forceDeleteData)
    }

    const deleteCD = (force: boolean, cascadeDelete: boolean) => {
        const isPartialDelete =
            formData.deploymentAppType === DeploymentAppType.GitOps &&
            formData.deploymentAppCreated &&
            !force
        const payload = {
            action: isPartialDelete ? CD_PATCH_ACTION.DEPLOYMENT_PARTIAL_DELETE : CD_PATCH_ACTION.DELETE,
            appId: parseInt(appId),
            pipeline: {
                id: +cdPipelineId,
            },
        }
        deleteCDPipeline(payload, force, cascadeDelete)
            .then((response) => {
                if (response.result) {
                    if (cascadeDelete && !response.result.deleteResponse?.clusterReachable && !response.result.deleteResponse?.deleteInitiated) {
                            hideDeleteModal()
                            const form = {...formData}
                            form.clusterName = response.result.deleteResponse?.clusterName
                            setFormData(form)
                            setDeleteDialog(deleteDialogType.showNonCascadeDeleteDialog)
                    } else {
                        toast.success(TOAST_INFO.PIPELINE_DELETION_INIT)
                        hideDeleteModal()
                        const form = {...formData}
                        form.clusterName = response.result.deleteResponse?.clusterName
                        setFormData(form)
                        setDeleteDialog(deleteDialogType.showNormalDeleteDialog)
                        close()
                        if (isWebhookCD) {
                            refreshParentWorkflows()
                        }
                        getWorkflows()
                    }
                }
            })
            .catch((error: ServerErrors) => {
                if (!force && error.code != 403) {
                    setForceDeleteDialogData(error)
                    hideDeleteModal()
                    setDeleteDialog(deleteDialogType.showForceDeleteDialog)
                } else {
                    showError(error)
                }
            })
    }

    const handleDeletePipeline = (deleteAction: DELETE_ACTION) => {
        switch (deleteAction) {
            case DELETE_ACTION.DELETE:
                return deleteCD(false, true)
            case DELETE_ACTION.NONCASCADE_DELETE:
                return formData.deploymentAppType === DeploymentAppType.GitOps
                    ? deleteCD(false, false)
                    : deleteCD(false, true)
            case DELETE_ACTION.FORCE_DELETE:
                return deleteCD(true, false)
        }
    }

    const onClickHideNonCascadeDeletePopup = () => {
        setDeleteDialog(deleteDialogType.showNormalDeleteDialog)
    }

    const  onClickNonCascadeDelete = () => {
        onClickHideNonCascadeDeletePopup()
        handleDeletePipeline(DELETE_ACTION.NONCASCADE_DELETE)
    }

    const renderDeleteCDModal = () => {
        if(deleteDialog === deleteDialogType.showForceDeleteDialog){
            return (
                <ForceDeleteDialog
                    forceDeleteDialogTitle={forceDeleteData.forceDeleteDialogTitle}
                    onClickDelete={() => handleDeletePipeline(DELETE_ACTION.FORCE_DELETE)}
                    closeDeleteModal={hideDeleteModal}
                    forceDeleteDialogMessage={forceDeleteData.forceDeleteDialogMessage}
                />
            )
        } else if(deleteDialog === deleteDialogType.showNonCascadeDeleteDialog){
            return ( 
                <ClusterNotReachableDailog
                    clusterName={formData.clusterName}
                    onClickCancel={onClickHideNonCascadeDeletePopup}
                    onClickDelete={onClickNonCascadeDelete}
                />
            )
        } else {
            return (
                <DeleteDialog
                    title={`Delete '${formData.name}' ?`}
                    description={`Are you sure you want to delete this CD Pipeline from '${appName}' ?`}
                    delete={() => handleDeletePipeline(DELETE_ACTION.DELETE)}
                    closeDelete={hideDeleteModal}
                />
            )
        }
    }

    const getNavLink = (toLink: string, stageName: string) => {    
        const showAlert = !formDataErrorObj[stageName].isValid
        const showWarning =
            mandatoryPluginData &&
            ((stageName === BuildStageVariable.PreBuild && !mandatoryPluginData.isValidPre) ||
                (stageName === BuildStageVariable.PostBuild && !mandatoryPluginData.isValidPost))
        return (
            <li className="tab-list__tab">
                <NavLink
                    data-testid={`${toLink}-button`}
                    replace
                    className="tab-list__tab-link fs-13 pt-5 pb-5 flexbox"
                    activeClassName="active"
                    to={`${toLink}?${urlParams}`}
                    onClick={() => {
                        validateStage(activeStageName, formData)
                    }}
                >
                    {BuildTabText[stageName]}
                    {(showAlert || showWarning) && (
                        <WarningTriangle
                            className={`icon-dim-16 mr-5 ml-5 mt-3 ${
                                showAlert ? 'alert-icon-r5-imp' : 'warning-icon-y7-imp'
                            }`}
                        />
                    )}
                </NavLink>
            </li>
        )
    }

    const renderSecondaryButton = () => {
        if (cdPipelineId) {
            let canDeletePipeline = downstreamNodeSize === 0
            let message =
                downstreamNodeSize > 0
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
                        data-testid="ci-delete-pipeline-button"
                        type="button"
                        className={`cta cta--workflow delete mr-16`}
                        disabled={!canDeletePipeline}
                        onClick={() => {
                            setShowDeleteModal(true)
                        }}
                    >
                        Delete Pipeline
                    </button>
                </ConditionalWrap>
            )
        }else if (!isAdvanced) {
            return (
                <button
                    type="button"
                    data-testid="create-build-pipeline-advanced-options-button"
                    className="cta cta--workflow cancel mr-16 flex"
                    onClick={() => {
                        setIsAdvanced(true)
                    }}
                >
                    Advanced options
                    {mandatoryPluginData && (!mandatoryPluginData.isValidPre || !mandatoryPluginData.isValidPost) && (
                        <WarningTriangle className="ml-6 icon-dim-16 warning-icon-y7-imp" />
                    )}
                </button>
            )
        }
    }

    const closePipelineModal = () => {
        close()
    }

    const renderCDPipelineModal = () => {
        return (
            <div
                className={`modal__body modal__body__ci_new_ui br-0 modal__body--p-0 ${
                    isAdvanced ? 'advanced-option-container' : 'bottom-border-radius'
                }`}
            >
                <div className="flex flex-align-center flex-justify bcn-0 pt-16 pr-20 pb-16 pl-20">
                    <h2 className="fs-16 fw-6 lh-1-43 m-0" data-testid="build-pipeline-heading">
                        {title}
                    </h2>
                    <button type="button" className="dc__transparent flex icon-dim-24" onClick={closePipelineModal}>
                        <Close className="icon-dim-24" />
                    </button>
                </div>
                {isAdvanced && (
                    <ul className="ml-20 tab-list w-90">
                            <>
                                {isAdvanced && getNavLink(`pre-build`, BuildStageVariable.PreBuild)}
                                {getNavLink(`build`, BuildStageVariable.Build)}
                                {isAdvanced && getNavLink(`post-build`, BuildStageVariable.PostBuild)}
                            </>
                    </ul>
                )}
                <hr className="divider m-0" />
                <pipelineContext.Provider
                    value={{
                        formData,
                        isCdPipeline,
                        setFormData,
                        handleStrategy,
                        appId,
                        activeStageName,
                        formDataErrorObj,
                        setFormDataErrorObj,
                        inputVariablesListFromPrevStep,
                        selectedTaskIndex,
                        setSelectedTaskIndex,
                        calculateLastStepDetail,
                        validateTask,
                        validateStage,
                        addNewTask,
                        configurationType,
                        setConfigurationType,
                        pageState,
                        setPageState,
                        globalVariables,
                        configMapAndSecrets,
                        getPrePostStageInEnv,
                        isVirtualEnvironment
                    }}
                >
                    <div className={`ci-pipeline-advance ${isAdvanced ? 'pipeline-container' : ''} ${activeStageName === BuildStageVariable.Build ? 'no-side-bar' : ''}`}>
                        {!(isCdPipeline && activeStageName === BuildStageVariable.Build) && isAdvanced && (
                            <div className="sidebar-container">
                                <Sidebar
                                    mandatoryPluginData={mandatoryPluginData}
                                    pluginList={[...presetPlugins, ...sharedPlugins]}
                                    setInputVariablesListFromPrevStep={setInputVariablesListFromPrevStep}
                                    mandatoryPluginsMap={mandatoryPluginsMap}
                                />
                            </div>
                        )}
                        <Switch>
                            {isAdvanced && (
                                <Route path={`${path}/pre-build`}>
                                    <PreBuild
                                        presetPlugins={presetPlugins}
                                        sharedPlugins={sharedPlugins}
                                        mandatoryPluginsMap={mandatoryPluginsMap}
                                    />
                                </Route>
                            )}
                            {isAdvanced && (
                                <Route path={`${path}/post-build`}>
                                    <PreBuild
                                        presetPlugins={presetPlugins}
                                        sharedPlugins={sharedPlugins}
                                        mandatoryPluginsMap={mandatoryPluginsMap}
                                    />
                                </Route>
                            )}
                            <Route path={`${path}/build`}>
                                <BuildCD
                                    allStrategies={allStrategies}
                                    isAdvanced={isAdvanced}
                                    setIsVirtualEnvironment={setIsVirtualEnvironment}
                                    noStrategyAvailable={noStrategyAvailable}
                                    showFormError={showFormError}
                                />
                            </Route>
                            <Redirect to={`${path}/build`} />
                        </Switch>
                    </div>
                </pipelineContext.Provider>
                {pageState !== ViewType.LOADING && (
                    <>
                        <div
                            className={`ci-button-container bcn-0 pt-12 pb-12 pl-20 pr-20 flex bottom-border-radius ${
                                cdPipelineId || !isAdvanced ? 'flex-justify' : 'justify-right'
                            } `}
                        >
                            {formData && (
                                <>
                                {renderSecondaryButton()}
                                <ButtonWithLoader
                                    rootClassName="cta cta--workflow"
                                    loaderColor="white"
                                    dataTestId="build-pipeline-button"
                                    onClick={savePipeline}
                                    isLoading={loadingData}
                                >
                                    {text}
                                </ButtonWithLoader>
                                </>
                            )}
                        </div>
                    </>
                )}
                {cdPipelineId && showDeleteModal && renderDeleteCDModal()}
            </div>
        )
    }

    return cdPipelineId || isAdvanced ? (
        <Drawer position="right" width="75%" minWidth="1024px" maxWidth="1200px">
            {renderCDPipelineModal()}
        </Drawer>
    ) : (
        <VisibleModal className="">{renderCDPipelineModal()}</VisibleModal>
    )
}
