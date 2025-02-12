import React, { useState } from 'react'
import { VisibleModal, copyToClipboard } from '@devtron-labs/devtron-fe-common-lib'
import Tippy from '@tippyjs/react'
import { ReactComponent as Success } from '../../../../assets/icons/ic-success-outline.svg'
import { ReactComponent as Clipboard } from '../../../../assets/icons/ic-copy.svg'
import { ReactComponent as Close } from '../../../../assets/icons/ic-close.svg'
import { ReactComponent as Key } from '../../../../assets/icons/ic-key-bulb.svg'
import { GenerateTokenModalType } from './authorization.type'

const GenerateModal = ({ close, token, reload, redirectToTokenList, isRegenerationModal }: GenerateTokenModalType) => {
    const [copied, setCopied] = useState(false)
    const modelType = isRegenerationModal ? 'regenerated' : 'generated'
    const handleCloseButton = () => {
        close()
        reload()
        redirectToTokenList()
    }

    const handleTippyText = (_tippy) => {
        setTimeout(() => {
            _tippy.hide()
            setCopied(false)
        }, 5000)
    }

    const handleCopyToClipboard = (e) => {
        e.stopPropagation()
        copyToClipboard(token, () => setCopied(true))
    }

    return (
        <VisibleModal className="generate-token-modal">
            <div className="modal__body w-600 pl-20 pr-20 pt-20 pb-20 flex column">
                {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                <button
                    type="button"
                    data-testid={`${modelType}-token-modal-close`}
                    className="w-100 flex right dc__transparent"
                    onClick={handleCloseButton}
                >
                    <Close className="icon-dim-24" />
                </button>
                <Success className="dc__vertical-align-middle mb-16" />

                <div className="modal__header ">
                    <h2 className="modal__title fs-16">API token {modelType}</h2>
                </div>
                <div
                    className="flex top left bcg-1 br-4 eg-2 bw-1 pl-16 pr-16 pt-10 pb-10 dc__break-word"
                    style={{ width: '560px' }}
                >
                    <Key className="api-token-icon icon-dim-20 mr-10" />
                    <span data-testid={`${modelType}-token`} className="api-token-text cn-9 fs-14">
                        {token}
                    </span>
                </div>
                <Tippy
                    className="default-tt"
                    arrow={false}
                    placement="top"
                    content={copied ? 'Copied!' : 'Copy'}
                    trigger="mouseenter click"
                    onShow={(_tippy) => {
                        handleTippyText(_tippy)
                    }}
                >
                    <button type="button" className="flex cta mt-20 mb-20" onClick={handleCopyToClipboard}>
                        <Clipboard className="icon-dim-16" />
                        &nbsp; Copy token
                    </button>
                </Tippy>
            </div>
        </VisibleModal>
    )
}

export default GenerateModal
