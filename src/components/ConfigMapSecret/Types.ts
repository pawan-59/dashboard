import { ComponentStates } from '../EnvironmentOverride/EnvironmentOverrides.type'

export interface KeyValueInputInterface {
    keyLabel: string
    valueLabel: string
    k: string
    v: string
    index: number
    onChange: any
    onDelete: any
    keyError?: string
    valueError?: string
    valueType?: string
}

export interface ResizableTextareaProps {
    minHeight?: number
    maxHeight?: number
    value?: string
    onChange?: (e) => void
    onBlur?: (e) => void
    onFocus?: (e) => void
    className?: string
    placeholder?: string
    lineHeight?: number
    padding?: number
    disabled?: boolean
    name?: string
    dataTestId?: string
}

export interface keyValueYaml {
    yaml: string
    handleYamlChange: any
    error: string
}
export interface KeyValue {
    k: string
    v: string
    keyError?: string
    valueError?: string
}
export interface KeyValueValidated {
    isValid: boolean
    arr: KeyValue[]
}

export interface ConfigMapListProps {
    isOverrideView?: boolean
    parentState?: ComponentStates
    setParentState?: React.Dispatch<React.SetStateAction<ComponentStates>>
}

export interface ConfigMapSecretFormProps {
    appChartRef: { id: number; version: string; name: string }
    toggleCollapse: any
    configMapSecretData: any
    id
    reload
    isOverrideView
    componentType: string
}

export interface ConfigMapSecretProps {
    componentType: string
    title: string
    appChartRef: any
    appId: number
    update: (index, result) => void
    data?: any
    index?: number
    id?: number
    isOverrideView?: boolean
}

export interface TabProps {
    title: string
    value: string
    active: boolean
    onClick: (title) => void
    type: string
    disabled?: boolean
}
