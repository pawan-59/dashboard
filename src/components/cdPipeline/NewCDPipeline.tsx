import {
    BuildStageVariable,
    DeploymentAppTypes,
    Drawer,
    ErrorScreenManager,
    OptionType,
    PluginDetailType,
    RefVariableType,
    ServerErrors,
    showError,
    VariableType,
    VisibleModal,
    PipelineType,
} from '@devtron-labs/devtron-fe-common-lib'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Redirect, Route, Switch, useParams, useRouteMatch } from 'react-router-dom'
import yamlJsParser from 'yaml'
import { toast } from 'react-toastify'
import { ReactComponent as Close } from '../../assets/icons/ic-close.svg'
import { CDDeploymentTabText, SourceTypeMap, TriggerType, ViewType } from '../../config'
import { ButtonWithLoader, FloatingVariablesSuggestions, sortObjectArrayAlphabetically } from '../common'
import BuildCD from './BuildCD'
import { CD_PATCH_ACTION, Environment, GeneratedHelmPush } from './cdPipeline.types'
import {
    deleteCDPipeline,
    getCDPipelineConfig,
    getCDPipelineNameSuggestion,
    getConfigMapAndSecrets,
    getDeploymentStrategyList,
    saveCDPipeline,
    updateCDPipeline,
} from './cdPipeline.service'
import { getEnvironmentListMinPublic } from '../../services/service'
import { Sidebar } from '../CIPipelineN/Sidebar'
import DeleteCDNode from './DeleteCDNode'
import { PreBuild } from '../CIPipelineN/PreBuild'
import { getGlobalVariable, getPluginsData } from '../ciPipeline/ciPipeline.service'
import { ValidationRules } from '../ciPipeline/validationRules'
import { ReactComponent as WarningTriangle } from '../../assets/icons/ic-warning.svg'
import './cdPipeline.scss'
import {
    CHANGE_TO_EXTERNAL_SOURCE,
    CREATE_DEPLOYMENT_PIPELINE,
    DEPLOY_IMAGE_EXTERNALSOURCE,
    EDIT_DEPLOYMENT_PIPELINE,
    MULTI_REQUIRED_FIELDS_MSG,
    TOAST_INFO,
} from '../../config/constantMessaging'
import { calculateLastStepDetailsLogic, checkUniqueness, validateTask } from './cdpipeline.util'
import { pipelineContext } from '../workflowEditor/workflowEditor'
import { PipelineFormDataErrorType, PipelineFormType } from '../workflowEditor/types'
import { getDockerRegistryMinAuth } from '../ciConfig/service'
import { customTagStageTypeOptions, getCDStageTypeSelectorValue, StageTypeEnums } from '../CIPipelineN/ciPipeline.utils'
import { DeleteDialogType, ForceDeleteMessageType, NewCDPipelineProps } from './types'

export default function NewCDPipeline({
    match,
    location,
    appName,
    close,
    getWorkflows,
    refreshParentWorkflows,
    envIds,
    changeCIPayload,
}: NewCDPipelineProps) {
    const isCdPipeline = true
    const urlParams = new URLSearchParams(location.search)
    const validationRules = new ValidationRules()
    const isWebhookCD = window.location.href.includes('webhook')
    const allStrategies = useRef<{ [key: string]: any }>({})
    const noStrategyAvailable = useRef(false)
    const parentPipelineTypeFromURL = urlParams.get('parentPipelineType')
    const parentPipelineId = urlParams.get('parentPipelineId')
    const addType = urlParams.get('addType')
    const childPipelineId = urlParams.get('childPipelineId')

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
    const text = cdPipelineId ? 'Update Pipeline' : 'Create Pipeline'
    const [formData, setFormData] = useState<PipelineFormType>({
        name: '',
        ciPipelineId: isWebhookCD ? null : +ciPipelineId,
        environmentId: 0,
        environments: [],
        environmentName: '',
        namespace: '',
        deploymentAppType: window._env_.HIDE_GITOPS_OR_HELM_OPTION ? '' : DeploymentAppTypes.HELM,
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
        clusterId: null,
        runPreStageInEnv: false,
        runPostStageInEnv: false,
        allowedDeploymentTypes: [],
        containerRegistryName: '',
        repoName: '',
        selectedRegistry: null,
        generatedHelmPushAction: GeneratedHelmPush.DO_NOT_PUSH,
        isDigestEnforcedForPipeline: false,
        isDigestEnforcedForEnv: false,
    })
    const [configMapAndSecrets, setConfigMapAndSecrets] = useState([])
    const [savedCustomTagPattern, setSavedCustomTagPattern] = useState<string>('')
    const [presetPlugins, setPresetPlugins] = useState<PluginDetailType[]>([])
    const [sharedPlugins, setSharedPlugins] = useState<PluginDetailType[]>([])
    const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0)
    const [configurationType, setConfigurationType] = useState<string>('GUI')
    const [globalVariables, setGlobalVariables] = useState<
        { label: string; value: string; format: string; stageType: string }[]
    >([])
    const [loadingData, setLoadingData] = useState<boolean>(false)
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
    const [deleteDialog, setDeleteDialog] = useState<DeleteDialogType>(DeleteDialogType.showNormalDeleteDialog)
    const [forceDeleteData, setForceDeleteData] = useState<ForceDeleteMessageType>({
        forceDeleteDialogMessage: '',
        forceDeleteDialogTitle: '',
    })
    const { path } = useRouteMatch()
    const [pageState, setPageState] = useState(ViewType.LOADING)
    const [isEnvUsedState, setIsEnvUsedState] = useState<boolean>(false)
    const [isVirtualEnvironment, setIsVirtualEnvironment] = useState<boolean>()
    const [isAdvanced, setIsAdvanced] = useState<boolean>(!!cdPipelineId)
    const [errorCode, setErrorCode] = useState<number>()
    const [dockerRegistries, setDockerRegistries] = useState<any[]>([])
    const parentPipelineType = parentPipelineTypeFromURL
        ? parentPipelineTypeFromURL.toLocaleUpperCase().replace('-', '_')
        : isWebhookCD
          ? SourceTypeMap.WEBHOOK
          : ''

    const [formDataErrorObj, setFormDataErrorObj] = useState<PipelineFormDataErrorType>({
        name: { isValid: true },
        envNameError: { isValid: true },
        nameSpaceError: { isValid: true },
        containerRegistryError: { isValid: true, message: '' },
        repositoryError: { isValid: true, message: '' },
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
    const [selectedCDStageTypeValue, setSelectedCDStageTypeValue] = useState<OptionType>(customTagStageTypeOptions[0])

    useEffect(() => {
        getInit()
        document.addEventListener('keydown', escFunction)
    }, [])

    useEffect(() => {
        if (formData.environmentId) {
            getConfigMapSecrets()
        }
    }, [formData.environmentId])

    const escFunction = (event) => {
        if ((event.keyCode === 27 || event.key === 'Escape') && typeof close === 'function') {
            close()
        }
    }

    const getInit = () => {
        Promise.all([
            getDeploymentStrategyList(appId),
            getGlobalVariable(Number(appId), true),
            getDockerRegistryMinAuth(appId, true),
        ])
            .then(([pipelineStrategyResponse, envResponse, dockerResponse]) => {
                const strategies = pipelineStrategyResponse.result.pipelineStrategy || []
                const dockerRegistries = dockerResponse.result || []
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
                    getCDPipeline(_form, dockerRegistries)
                } else {
                    getEnvCDPipelineName(_form)
                    if (strategies.length > 0) {
                        const defaultStrategy = strategies.find((strategy) => strategy.default)
                        handleStrategy(defaultStrategy.deploymentTemplate)
                    }
                }

                const _globalVariableOptions = envResponse.result?.map((variable) => {
                    variable.label = variable.name
                    variable.value = variable.name
                    variable.description = variable.description || ''
                    variable.variableType = RefVariableType.GLOBAL
                    delete variable.name
                    return variable
                })

                setGlobalVariables(_globalVariableOptions || [])
                setDockerRegistries(dockerRegistries)
            })
            .catch((error: ServerErrors) => {
                showError(error)
                setErrorCode(error.code)
                setPageState(ViewType.ERROR)
            })
    }

    const getEnvCDPipelineName = (form) => {
        Promise.all([getCDPipelineNameSuggestion(appId), getEnvironmentListMinPublic(true)])
            .then(([cpPipelineName, envList]) => {
                form.name = cpPipelineName.result
                let list = envList.result || []
                list = list.map((env) => {
                    return {
                        id: env.id,
                        clusterId: env.cluster_id,
                        clusterName: env.cluster_name,
                        name: env.environment_name,
                        namespace: env.namespace || '',
                        active: false,
                        isClusterCdActive: env.isClusterCdActive,
                        description: env.description,
                        isVirtualEnvironment: env.isVirtualEnvironment,
                        allowedDeploymentTypes: env.allowedDeploymentTypes || [],
                        isDigestEnforcedForEnv: env.isDigestEnforcedForEnv,
                    }
                })
                sortObjectArrayAlphabetically(list, 'name')
                form.environments = list
                setFormData(form)
                setPageState(ViewType.FORM)
                setIsAdvanced(false)
            })
            .catch((error) => {
                showError(error)
            })
    }

    const calculateLastStepDetail = (
        isFromAddNewTask: boolean,
        _formData: PipelineFormType,
        activeStageName: string,
        startIndex?: number,
        isFromMoveTask?: boolean,
    ): {
        index: number
        calculatedStageVariables: Map<string, VariableType>[]
    } => {
        const _formDataErrorObj = { ...formDataErrorObj }
        const { stepsLength, _inputVariablesListPerTask } = calculateLastStepDetailsLogic(
            _formData,
            activeStageName,
            _formDataErrorObj,
            isFromAddNewTask,
            startIndex,
            isFromMoveTask,
            isCdPipeline,
            globalVariables,
        )
        const _inputVariablesListFromPrevStep = { ...inputVariablesListFromPrevStep }
        _inputVariablesListFromPrevStep[activeStageName] = _inputVariablesListPerTask
        setInputVariablesListFromPrevStep(_inputVariablesListFromPrevStep)
        setFormDataErrorObj(_formDataErrorObj)
        return { index: stepsLength + 1, calculatedStageVariables: _inputVariablesListPerTask }
    }

    const getCDPipeline = (form, dockerRegistries): void => {
        getCDPipelineConfig(appId, cdPipelineId)
            .then((result) => {
                const pipelineConfigFromRes = result.pipelineConfig
                updateStateFromResponse(pipelineConfigFromRes, result.environments, form, dockerRegistries)
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
                setIsVirtualEnvironment(pipelineConfigFromRes.isVirtualEnvironment)
                setFormData({
                    ...form,
                    clusterId: result.form?.clusterId,
                })
                setSavedCustomTagPattern(pipelineConfigFromRes.customTag?.tagPattern)
                setPageState(ViewType.FORM)
                setSelectedCDStageTypeValue(getCDStageTypeSelectorValue(form.customTagStage))
            })
            .catch((error: ServerErrors) => {
                showError(error)
                setPageState(ViewType.ERROR)
                setErrorCode(error.code)
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

    const getPrePostStageInEnv = (isVirtualEnvironment: boolean, isRunPrePostStageInEnv: boolean): boolean => {
        if (isVirtualEnvironment) {
            return true
        }
        return isRunPrePostStageInEnv ?? false
    }

    const getSecret = (secret: any) => {
        return {
            label: secret,
            value: `${secret}-cs`,
            type: 'secrets',
        }
    }

    const filterOutEmptySecret = (secret: any) => {
        return secret['label'].length
    }

    const updateStateFromResponse = (pipelineConfigFromRes, environments, form, dockerRegistries): void => {
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
                    defaultConfig: allStrategies.current[pipelineConfigFromRes.strategies[i].deploymentTemplate],
                    jsonStr: JSON.stringify(pipelineConfigFromRes.strategies[i].config, null, 4),
                    selection: yamlJsParser.stringify(
                        allStrategies.current[pipelineConfigFromRes.strategies[i].config],
                        {
                            indent: 2,
                        },
                    ),
                    isCollapsed: true,
                })
                form.strategies = form.strategies.filter(
                    (strategy) =>
                        strategy.deploymentTemplate !== pipelineConfigFromRes.strategies[i].deploymentTemplate,
                )
            }
        }
        const env = environments.find((e) => e.id === pipelineConfigFromRes.environmentId)
        form.name = pipelineConfigFromRes.name
        form.environmentName = pipelineConfigFromRes.environmentName || ''
        form.namespace = env.namespace
        form.repoName = pipelineConfigFromRes.repoName
        form.containerRegistryName = pipelineConfigFromRes.containerRegistryName
        form.manifestStorageType =
            pipelineConfigFromRes.deploymentAppType === DeploymentAppTypes.MANIFEST_PUSH
                ? GeneratedHelmPush.PUSH
                : 'helm_repo'
        form.environmentId = pipelineConfigFromRes.environmentId
        form.environments = environments
        form.savedStrategies = savedStrategies
        form.isClusterCdActive = pipelineConfigFromRes.isClusterCdActive || false
        form.deploymentAppType = pipelineConfigFromRes.deploymentAppType || ''
        form.deploymentAppCreated = pipelineConfigFromRes.deploymentAppCreated || false
        form.triggerType = pipelineConfigFromRes.triggerType || TriggerType.Auto
        form.userApprovalConfig = pipelineConfigFromRes.userApprovalConfig
        form.allowedDeploymentTypes = env.allowedDeploymentTypes || []
        form.customTag = pipelineConfigFromRes.customTag
        form.enableCustomTag = pipelineConfigFromRes.enableCustomTag
        form.customTagStage = pipelineConfigFromRes.customTagStage
        form.isDigestEnforcedForEnv = pipelineConfigFromRes.isDigestEnforcedForEnv
        form.isDigestEnforcedForPipeline = pipelineConfigFromRes.isDigestEnforcedForPipeline

        if (pipelineConfigFromRes?.preDeployStage) {
            if (pipelineConfigFromRes.preDeployStage.steps?.length > 0) {
                form.preBuildStage = pipelineConfigFromRes.preDeployStage
            } else {
                form.preBuildStage = {
                    ...pipelineConfigFromRes.preDeployStage,
                    steps: [],
                    triggerType: TriggerType.Auto,
                }
            }
        }
        if (pipelineConfigFromRes?.postDeployStage) {
            if (pipelineConfigFromRes.postDeployStage.steps?.length > 0) {
                form.postBuildStage = pipelineConfigFromRes?.postDeployStage
            } else {
                form.postDeployStage = {
                    ...pipelineConfigFromRes.postDeployStage,
                    steps: [],
                    triggerType: TriggerType.Auto,
                }
            }
        }
        form.requiredApprovals = `${pipelineConfigFromRes.userApprovalConfig?.requiredCount || ''}`
        form.preStageConfigMapSecretNames = {
            configMaps: pipelineConfigFromRes.preStageConfigMapSecretNames.configMaps
                ? pipelineConfigFromRes.preStageConfigMapSecretNames.configMaps.map((configmap) => {
                      return {
                          label: configmap,
                          value: `${configmap}-cm`,
                          type: 'configmaps',
                      }
                  })
                : [],
            secrets: pipelineConfigFromRes.preStageConfigMapSecretNames.secrets
                ? pipelineConfigFromRes.preStageConfigMapSecretNames.secrets.map((secret) => {
                      return {
                          label: secret,
                          value: `${secret}-cs`,
                          type: 'secrets',
                      }
                  })
                : [],
        }
        form.postStageConfigMapSecretNames = {
            configMaps: pipelineConfigFromRes.postStageConfigMapSecretNames.configMaps
                ? pipelineConfigFromRes.postStageConfigMapSecretNames.configMaps.map((configmap) => {
                      return {
                          label: configmap,
                          value: `${configmap}-cm`,
                          type: 'configmaps',
                      }
                  })
                : [],
            secrets: pipelineConfigFromRes.postStageConfigMapSecretNames.secrets
                ? pipelineConfigFromRes.postStageConfigMapSecretNames.secrets
                      .map(getSecret)
                      .filter(filterOutEmptySecret)
                : [],
        }
        form.runPreStageInEnv = getPrePostStageInEnv(isVirtualEnvironment, pipelineConfigFromRes.runPreStageInEnv)
        form.runPostStageInEnv = getPrePostStageInEnv(isVirtualEnvironment, pipelineConfigFromRes.runPostStageInEnv)
        form.generatedHelmPushAction =
            pipelineConfigFromRes.deploymentAppType === DeploymentAppTypes.MANIFEST_PUSH
                ? GeneratedHelmPush.PUSH
                : GeneratedHelmPush.DO_NOT_PUSH
        form.selectedRegistry = dockerRegistries.find(
            (dockerRegistry) => dockerRegistry.id === pipelineConfigFromRes.containerRegistryName,
        )
    }

    const responseCode = () => {
        const _preStageConfigMapSecretNames = {
            configMaps: formData.preStageConfigMapSecretNames.configMaps.map((config) => {
                return config['label']
            }),
            secrets: formData.preStageConfigMapSecretNames.secrets.map((secret) => {
                return secret['label']
            }),
        }

        const _postStageConfigMapSecretNames = {
            configMaps: formData.postStageConfigMapSecretNames.configMaps.map((config) => {
                return config['label']
            }),
            secrets: formData.postStageConfigMapSecretNames.secrets.map((secret) => {
                return secret['label']
            }),
        }

        const _userApprovalConfig =
            formData.requiredApprovals?.length > 0
                ? {
                      requiredCount: +formData.requiredApprovals,
                  }
                : null

        const pipeline = {
            name: formData.name,
            appWorkflowId: +workflowId,
            ciPipelineId: +ciPipelineId,
            environmentId: formData.environmentId,
            namespace: formData.namespace,
            id: +cdPipelineId,
            strategies: formData.savedStrategies,
            parentPipelineType,
            parentPipelineId: +parentPipelineId,
            isClusterCdActive: formData.isClusterCdActive,
            deploymentAppType: formData.deploymentAppType,
            deploymentAppCreated: formData.deploymentAppCreated,
            userApprovalConfig: _userApprovalConfig,
            triggerType: formData.triggerType,
            environmentName: formData.environmentName,
            preStageConfigMapSecretNames: _preStageConfigMapSecretNames,
            postStageConfigMapSecretNames: _postStageConfigMapSecretNames,
            containerRegistryName:
                formData.generatedHelmPushAction === GeneratedHelmPush.PUSH ? formData.containerRegistryName : '',
            repoName: formData.generatedHelmPushAction === GeneratedHelmPush.PUSH ? formData.repoName : '',
            manifestStorageType: formData.generatedHelmPushAction === GeneratedHelmPush.PUSH ? 'helm_repo' : '',
            runPreStageInEnv: formData.runPreStageInEnv,
            runPostStageInEnv: formData.runPostStageInEnv,
            preDeployStage: {},
            postDeployStage: {},
            customTag: {
                tagPattern: formData.customTag ? formData.customTag.tagPattern : '',
                counterX: formData.customTag ? +formData.customTag.counterX : 0,
            },
            enableCustomTag: formData.enableCustomTag,
            customTagStage: formData?.customTagStage ? formData.customTagStage : StageTypeEnums.PRE_CD,
            isDigestEnforcedForPipeline: formData.isDigestEnforcedForPipeline,
            isDigestEnforcedForEnv: formData.isDigestEnforcedForEnv,
        }

        if (isVirtualEnvironment) {
            pipeline.deploymentAppType =
                formData.generatedHelmPushAction === GeneratedHelmPush.PUSH
                    ? DeploymentAppTypes.MANIFEST_PUSH
                    : DeploymentAppTypes.MANIFEST_DOWNLOAD
            pipeline.triggerType =
                formData.generatedHelmPushAction === GeneratedHelmPush.DO_NOT_PUSH
                    ? TriggerType.Manual
                    : formData.triggerType // In case of virtual environment trigger type will always be manual
        }

        // Its not allowed to switch from external to external
        if (changeCIPayload?.switchFromCiPipelineId) {
            pipeline['switchFromCiPipelineId'] = changeCIPayload.switchFromCiPipelineId
        }
        if (childPipelineId) {
            pipeline['childPipelineId'] = +childPipelineId
        }

        pipeline['addType'] = addType

        const request = {
            appId: +appId,
        }
        if (!cdPipelineId) {
            request['pipelines'] = [pipeline]
        } else {
            request['pipeline'] = pipeline
            request['action'] = CD_PATCH_ACTION.UPDATE
        }

        if (formData.preBuildStage.steps.length > 0) {
            let { preBuildStage } = formData
            if (isVirtualEnvironment) {
                preBuildStage = {
                    ...preBuildStage,
                    triggerType:
                        formData.generatedHelmPushAction === GeneratedHelmPush.DO_NOT_PUSH
                            ? TriggerType.Manual
                            : formData.preBuildStage.triggerType,
                }
            }
            pipeline.preDeployStage = preBuildStage
        }
        if (formData.postBuildStage.steps.length > 0) {
            let { postBuildStage } = formData
            if (isVirtualEnvironment) {
                postBuildStage = {
                    ...postBuildStage,
                    triggerType:
                        formData.generatedHelmPushAction === GeneratedHelmPush.DO_NOT_PUSH
                            ? TriggerType.Manual
                            : formData.postBuildStage.triggerType,
                }
            }
            pipeline.postDeployStage = postBuildStage
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

        const _form = { ...formData }
        _form.savedStrategies.push(newSelection)
        _form.savedStrategies = [newSelection]
        setFormData(_form)
    }

    const validateStage = (stageName: string, _formData: PipelineFormType, formDataErrorObject?): void => {
        const _formDataErrorObj = {
            ...(formDataErrorObject ?? formDataErrorObj),
            name: validationRules.name(_formData.name),
            envNameError: validationRules.environment(_formData.environmentId),
        } // validating name always as it's a mandatory field
        let isReposAndContainerRegistoryValid = true
        if (!isVirtualEnvironment) {
            _formDataErrorObj.nameSpaceError = validationRules.namespace(_formData.namespace)
        } else if (formData.generatedHelmPushAction === GeneratedHelmPush.PUSH) {
            _formDataErrorObj.containerRegistryError = validationRules.containerRegistry(
                formData.containerRegistryName || '',
            )
            _formDataErrorObj.repositoryError = validationRules.repository(formData.repoName)
            if (!(_formDataErrorObj.repositoryError.isValid && _formDataErrorObj.containerRegistryError.isValid)) {
                isReposAndContainerRegistoryValid = false
            }
        }

        if (stageName === BuildStageVariable.Build) {
            _formDataErrorObj[BuildStageVariable.Build].isValid =
                _formDataErrorObj.name.isValid &&
                _formDataErrorObj.envNameError.isValid &&
                isReposAndContainerRegistoryValid
        } else {
            const stepsLength = _formData[stageName].steps.length
            let isStageValid = true
            for (let i = 0; i < stepsLength; i++) {
                if (!_formDataErrorObj[stageName].steps[i]) {
                    _formDataErrorObj[stageName].steps.push({ isValid: true })
                }
                validateTask(_formData[stageName].steps[i], _formDataErrorObj[stageName].steps[i])
                isStageValid = isStageValid && _formDataErrorObj[stageName].steps[i].isValid
            }

            _formDataErrorObj[stageName].isValid = isStageValid
        }
        setFormDataErrorObj(_formDataErrorObj)
    }

    const savePipeline = () => {
        const isUnique = checkUniqueness(formData, true)
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

        const _form = { ...formData }

        const promise = cdPipelineId ? updateCDPipeline(request) : saveCDPipeline(request)
        promise
            .then((response) => {
                if (response.result) {
                    const pipelineConfigFromRes = response.result.pipelines[0]
                    updateStateFromResponse(pipelineConfigFromRes, _form.environments, _form, dockerRegistries)
                    let envName = pipelineConfigFromRes.environmentName
                    if (!envName) {
                        const selectedEnv: Environment = _form.environments.find((env) => env.id == _form.environmentId)
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
                        !cdPipelineId,
                    )
                    getWorkflows()
                }
            })
            .catch((error: ServerErrors) => {
                showError(error)
                setLoadingData(false)
            })
    }

    const hideDeleteModal = () => {
        setShowDeleteModal(false)
    }

    const setForceDeleteDialogData = (serverError) => {
        const _forceDeleteData = { ...forceDeleteData }
        setDeleteDialog(DeleteDialogType.showForceDeleteDialog)
        if (serverError instanceof ServerErrors && Array.isArray(serverError.errors)) {
            serverError.errors.map(({ userMessage, internalMessage }) => {
                _forceDeleteData.forceDeleteDialogMessage = internalMessage
                _forceDeleteData.forceDeleteDialogTitle = userMessage
            })
        }
        setForceDeleteData(_forceDeleteData)
    }

    const deleteCD = (force: boolean, cascadeDelete: boolean) => {
        const isPartialDelete =
            formData.deploymentAppType === DeploymentAppTypes.GITOPS && formData.deploymentAppCreated && !force
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
                    if (
                        cascadeDelete &&
                        !response.result.deleteResponse?.clusterReachable &&
                        !response.result.deleteResponse?.deleteInitiated
                    ) {
                        hideDeleteModal()
                        const form = { ...formData }
                        form.clusterName = response.result.deleteResponse?.clusterName
                        setFormData(form)
                        setDeleteDialog(DeleteDialogType.showNonCascadeDeleteDialog)
                    } else {
                        toast.success(TOAST_INFO.PIPELINE_DELETION_INIT)
                        hideDeleteModal()
                        const form = { ...formData }
                        form.clusterName = response.result.deleteResponse?.clusterName
                        setFormData(form)
                        setDeleteDialog(DeleteDialogType.showNormalDeleteDialog)
                        close()
                        if (isWebhookCD) {
                            refreshParentWorkflows()
                        }
                        getWorkflows()
                    }
                } else if (response.errors) {
                    setDeleteDialog(DeleteDialogType.showForceDeleteDialog)
                    setForceDeleteData({
                        forceDeleteDialogTitle: 'Something went wrong',
                        forceDeleteDialogMessage: response.errors[0].userMessage,
                    })
                }
            })
            .catch((error: ServerErrors) => {
                // 412 is for linked pipeline and 403 is for RBAC
                if (!force && error.code != 403 && error.code != 412) {
                    setForceDeleteDialogData(error)
                    hideDeleteModal()
                    setDeleteDialog(DeleteDialogType.showForceDeleteDialog)
                } else {
                    showError(error)
                }
            })
    }

    const handleAdvanceClick = () => {
        const form = { ...formData }
        const strategies = form.strategies.filter(
            (strategy) => strategy.deploymentTemplate != form.savedStrategies[0].deploymentTemplate,
        )
        form.strategies = strategies
        setFormData(form)
        setIsAdvanced(true)
    }

    const openDeleteModal = () => {
        setShowDeleteModal(true)
    }

    const getNavLink = (toLink: string, stageName: string) => {
        const showAlert = !formDataErrorObj[stageName].isValid
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
                    {CDDeploymentTabText[stageName]}
                    {showAlert && (
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
            return (
                <button
                    data-testid="ci-delete-pipeline-button"
                    type="button"
                    className="cta cta--workflow delete mr-16"
                    onClick={openDeleteModal}
                >
                    Delete Pipeline
                </button>
            )
        }
        if (!isAdvanced) {
            return (
                !isWebhookCD && (
                    <button
                        type="button"
                        data-testid="create-build-pipeline-advanced-options-button"
                        className="cta cta--workflow cancel mr-16 flex"
                        onClick={handleAdvanceClick}
                    >
                        Advanced options
                    </button>
                )
            )
        }
    }

    const closePipelineModal = () => {
        close()
    }

    const contextValue = useMemo(() => {
        return {
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
            isVirtualEnvironment,
            setInputVariablesListFromPrevStep,
            isEnvUsedState,
            setIsEnvUsedState,
            savedCustomTagPattern,
            selectedCDStageTypeValue,
            setSelectedCDStageTypeValue,
        }
    }, [
        formData,
        activeStageName,
        formDataErrorObj,
        inputVariablesListFromPrevStep,
        selectedTaskIndex,
        configurationType,
        pageState,
        globalVariables,
        configMapAndSecrets,
        isVirtualEnvironment,
    ])

    const renderCDPipelineBody = () => {
        if (pageState === ViewType.ERROR) {
            return (
                <div className="pipeline-empty-state">
                    <hr className="divider m-0" />
                    <div className="h-100 flex">
                        <ErrorScreenManager code={errorCode} />
                    </div>
                </div>
            )
        }

        return (
            <>
                {isAdvanced && (
                    <ul className="ml-20 tab-list w-90">
                        {isAdvanced && getNavLink(`pre-build`, BuildStageVariable.PreBuild)}
                        {getNavLink(`build`, BuildStageVariable.Build)}
                        {isAdvanced && getNavLink(`post-build`, BuildStageVariable.PostBuild)}
                    </ul>
                )}
                <hr className="divider m-0" />
                <pipelineContext.Provider value={contextValue}>
                    <div
                        className={`ci-pipeline-advance ${isAdvanced ? 'pipeline-container' : ''} ${
                            activeStageName === BuildStageVariable.Build ? 'no-side-bar' : ''
                        }`}
                    >
                        {!(isCdPipeline && activeStageName === BuildStageVariable.Build) && isAdvanced && (
                            <div className="sidebar-container">
                                <Sidebar
                                    pluginList={[...presetPlugins, ...sharedPlugins]}
                                    setInputVariablesListFromPrevStep={setInputVariablesListFromPrevStep}
                                />
                            </div>
                        )}
                        <Switch>
                            {isAdvanced && (
                                <Route path={`${path}/pre-build`}>
                                    <PreBuild presetPlugins={presetPlugins} sharedPlugins={sharedPlugins} />
                                </Route>
                            )}
                            {isAdvanced && (
                                <Route path={`${path}/post-build`}>
                                    <PreBuild presetPlugins={presetPlugins} sharedPlugins={sharedPlugins} />
                                </Route>
                            )}
                            <Route path={`${path}/build`}>
                                <BuildCD
                                    allStrategies={allStrategies}
                                    isAdvanced={isAdvanced}
                                    setIsVirtualEnvironment={setIsVirtualEnvironment}
                                    noStrategyAvailable={noStrategyAvailable}
                                    parentPipelineId={parentPipelineId}
                                    isWebhookCD={isWebhookCD}
                                    dockerRegistries={dockerRegistries}
                                    envIds={envIds}
                                />
                            </Route>
                            <Redirect to={`${path}/build`} />
                        </Switch>
                    </div>
                </pipelineContext.Provider>
            </>
        )
    }

    const renderCDPipelineModal = () => {
        let title
        if (isWebhookCD && workflowId === '0') {
            title = DEPLOY_IMAGE_EXTERNALSOURCE
        } else if (isWebhookCD && changeCIPayload) {
            title = CHANGE_TO_EXTERNAL_SOURCE
        } else if (cdPipelineId) {
            title = EDIT_DEPLOYMENT_PIPELINE
        } else {
            title = CREATE_DEPLOYMENT_PIPELINE
        }

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
                {renderCDPipelineBody()}
                {pageState !== ViewType.LOADING && pageState !== ViewType.ERROR && (
                    <div
                        className={`ci-button-container bcn-0 pt-12 pb-12 pl-20 pr-20 flex bottom-border-radius ${
                            !isWebhookCD && (cdPipelineId || !isAdvanced) ? 'flex-justify' : 'justify-right'
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
                )}
                {cdPipelineId && showDeleteModal && (
                    <DeleteCDNode
                        deleteDialog={deleteDialog}
                        setDeleteDialog={setDeleteDialog}
                        clusterName={formData.clusterName}
                        appName={appName}
                        hideDeleteModal={hideDeleteModal}
                        deleteCD={deleteCD}
                        deploymentAppType={formData.deploymentAppType}
                        forceDeleteData={forceDeleteData}
                        deleteTitleName={formData.name}
                    />
                )}
            </div>
        )
    }

    const renderFloatingVariablesWidget = () => {
        if (!window._env_.ENABLE_SCOPED_VARIABLES || activeStageName === BuildStageVariable.Build) {
            return <></>
        }

        return (
            <div className="flexbox">
                <div className="floating-scoped-variables-widget">
                    <FloatingVariablesSuggestions
                        zIndex={21}
                        appId={appId}
                        envId={formData?.environmentId ? String(formData.environmentId) : null}
                        clusterId={formData?.clusterId}
                    />
                </div>
            </div>
        )
    }

    return cdPipelineId || isAdvanced ? (
        <>
            {renderFloatingVariablesWidget()}

            <Drawer position="right" width="75%" minWidth="1024px" maxWidth="1200px">
                {renderCDPipelineModal()}
            </Drawer>
        </>
    ) : (
        <VisibleModal className="">{renderCDPipelineModal()}</VisibleModal>
    )
}
