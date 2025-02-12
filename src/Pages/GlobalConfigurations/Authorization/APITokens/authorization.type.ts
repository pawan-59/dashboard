import React from 'react'

export interface FormType {
    name: string
    description: string
    expireAtInMs: number
    dateType?: string
}
export interface TokenResponseType {
    success: boolean
    token: string
    userId: number
    userIdentifier: string
}

export interface GenerateTokenType {
    showGenerateModal: boolean
    setShowGenerateModal: React.Dispatch<React.SetStateAction<boolean>>
    handleGenerateTokenActionButton: () => void
    setSelectedExpirationDate
    selectedExpirationDate
    tokenResponse: TokenResponseType
    setTokenResponse: React.Dispatch<React.SetStateAction<TokenResponseType>>
    reload: () => void
}

export interface TokenListType {
    expireAtInMs: number
    id: number
    name: string
    token: string
    updatedAt: string
    userId: number
    userIdentifier: string
    description: string
    lastUsedByIp: string
    lastUsedAt: string
}
export interface EditTokenType {
    setShowRegeneratedModal: React.Dispatch<React.SetStateAction<boolean>>
    showRegeneratedModal: boolean
    handleRegenerateActionButton: () => void
    setSelectedExpirationDate
    selectedExpirationDate
    tokenList: TokenListType[]
    setCopied: React.Dispatch<React.SetStateAction<boolean>>
    copied: boolean
    reload: () => void
}

export interface GenerateActionButtonType {
    loader: boolean
    onCancel: () => void
    onSave: () => void
    buttonText: string
    regenerateButton?: boolean
}

export interface GenerateTokenModalType {
    close: () => void
    token: string
    reload: () => void
    redirectToTokenList: () => void
    isRegenerationModal?: boolean
}

export interface APITokenListType {
    tokenList: TokenListType[]
    renderSearchToken: () => void
    reload: () => void
}

export interface EditDataType {
    name: string
    description: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expireAtInMs: any
    token: string
    id: number
    userId: number
    userIdentifier: string
}
export interface RegenerateModalType {
    close: () => void
    setShowRegeneratedModal: React.Dispatch<React.SetStateAction<boolean>>
    editData: EditDataType
    customDate: number
    setCustomDate: React.Dispatch<React.SetStateAction<number>>
    reload: () => void
    redirectToTokenList: () => void
}
