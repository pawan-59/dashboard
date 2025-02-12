import React, { useState, useEffect, useRef } from 'react'
import ReactSelect, { components, MultiValue } from 'react-select'
import { Option } from '@devtron-labs/devtron-fe-common-lib'
import { ColumnMetadataType } from './types'
import { ReactComponent as Setting } from '../../assets/icons/ic-nav-gear.svg'
import { containerImageSelectStyles } from '../CIPipelineN/ciPipeline.utils'
import { useColumnFilterContext } from './NodeListSearchFilter'
import { COLUMN_METADATA } from './constants'

const ValueContainer = (props: any): JSX.Element => {
    const { length } = props.getValue()

    return (
        <components.ValueContainer {...props}>
            {length > 0 ? (
                <>
                    {!props.selectProps.menuIsOpen && (
                        <>
                            <Setting className="icon-dim-16 setting-icon mr-5" />
                            Columns
                        </>
                    )}
                    {React.cloneElement(props.children[1])}
                </>
            ) : (
                <>{props.children}</>
            )}
        </components.ValueContainer>
    )
}

const MenuList = (props: any): JSX.Element => {
    const {
        selectedColumns,
        setAppliedColumns,
        setMenuOpen,
    }: {
        selectedColumns: MultiValue<ColumnMetadataType>
        appliedColumns: MultiValue<ColumnMetadataType>
        setAppliedColumns: React.Dispatch<React.SetStateAction<MultiValue<ColumnMetadataType>>>
        isMenuOpen: boolean
        setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
    } = useColumnFilterContext()
    const handleApplySelectedColumns = (): void => {
        setMenuOpen(false)
        const _appliedColumns = [...selectedColumns].sort((a, b) => a['columnIndex'] - b['columnIndex'])
        if (typeof Storage !== 'undefined') {
            localStorage.appliedColumns = JSON.stringify(_appliedColumns)
        }
        if (props.selectRef.current) {
            props.selectRef.current.blur()
        }
        setAppliedColumns(_appliedColumns)
    }
    return (
        <components.MenuList {...props}>
            {props.children}
            <div className="flex dc__react-select__bottom bcn-0 p-8">
                <button className="flex cta apply-filter h-32 w-100" onClick={handleApplySelectedColumns}>
                    Apply
                </button>
            </div>
        </components.MenuList>
    )
}
export default function ColumnSelector() {
    const {
        appliedColumns,
        selectedColumns,
        setSelectedColumns,
        isMenuOpen,
        setMenuOpen,
    }: {
        appliedColumns: MultiValue<ColumnMetadataType>
        selectedColumns: MultiValue<ColumnMetadataType>
        setSelectedColumns: React.Dispatch<React.SetStateAction<MultiValue<ColumnMetadataType>>>
        isMenuOpen: boolean
        setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
    } = useColumnFilterContext()
    const [columnOptions, setColumnOptions] = useState<MultiValue<ColumnMetadataType>>([])
    const [columnFilterInput, setColumnFilterInput] = useState('')
    const selectRef = useRef(null)

    useEffect(() => {
        setColumnOptions(COLUMN_METADATA.filter((columnData) => !columnData.isDisabled))
        setSelectedColumns(appliedColumns)
    }, [])

    const handleMenuState = (menuOpenState: boolean): void => {
        if (menuOpenState) {
            setSelectedColumns(appliedColumns)
        }
        setMenuOpen(menuOpenState)
    }

    const handleCloseFilter = (): void => {
        handleMenuState(false)
        setSelectedColumns(appliedColumns)
    }

    return (
        <ReactSelect
            ref={selectRef}
            menuIsOpen={isMenuOpen}
            name="columns"
            value={selectedColumns}
            options={columnOptions}
            onChange={setSelectedColumns}
            isMulti
            autoFocus={false}
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            onMenuOpen={() => handleMenuState(true)}
            onMenuClose={handleCloseFilter}
            blurInputOnSelect={false}
            inputValue={columnFilterInput}
            onBlur={() => {
                setColumnFilterInput('')
            }}
            onInputChange={(value, action) => {
                if (action.action === 'input-change') {
                    setColumnFilterInput(value)
                }
            }}
            components={{
                Option,
                ValueContainer,
                IndicatorSeparator: null,
                ClearIndicator: null,
                MenuList: (props) => <MenuList {...props} selectRef={selectRef} />,
            }}
            styles={{
                ...containerImageSelectStyles,
                menu: (base, state) => ({
                    ...base,
                    zIndex: 6,
                }),
                menuList: (base, state) => ({
                    ...base,
                    borderRadius: '4px',
                    paddingTop: 0,
                    paddingBottom: 0,
                }),
                option: (base, state) => ({
                    ...base,
                    padding: '10px 12px',
                    backgroundColor: state.isFocused ? 'var(--N100) !important' : 'var(--N0) !important',
                    color: 'var(--N900)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                }),
                dropdownIndicator: (base, state) => ({
                    ...base,
                    color: 'var(--N400)',
                    transition: 'all .2s ease',
                    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    padding: '0 8px',
                }),
            }}
        />
    )
}
