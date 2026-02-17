/**
 * Resumaker
 * (c) 2026 ayeci
 * Released under the MIT License.
 */

import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import OutlinedInput from '@mui/material/OutlinedInput';
import type { SxProps, Theme } from '@mui/material/styles';
import type { NumberFieldRootChangeEventDetails } from '@base-ui/react/number-field';

interface NumberSpinnerProps {
    id?: string;
    label?: React.ReactNode;
    error?: boolean;
    value: number;
    onValueChange: (value: number | null, eventDetails: NumberFieldRootChangeEventDetails) => void;
    min?: number;
    max?: number;
    step?: number;
    size?: 'small' | 'medium';
    disabled?: boolean;
    'aria-label'?: string;
    sx?: SxProps<Theme>;
    className?: string;
}

/**
 * 数値スピナーコンポーネント
 */
export default function NumberSpinner({
    id,
    label,
    size = 'medium',
    value,
    onValueChange,
    min,
    max,
    step = 1,
    disabled,
    'aria-label': ariaLabel,
    sx,
    className,
    ...other
}: NumberSpinnerProps) {

    return (
        <BaseNumberField.Root
            id={id}
            value={value}
            onValueChange={onValueChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            {...other}
        >
            <Box
                className={className}
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    '&:hover': {
                        borderColor: 'text.primary',
                    },
                    ...sx,
                }}
            >
                {/* 減らすボタン */}
                <BaseNumberField.Decrement
                    render={
                        <Button
                            variant="text"
                            size={size}
                            sx={{
                                minWidth: '32px',
                                width: '32px',
                                p: 0,
                                borderRadius: 0,
                                borderRight: '1px solid',
                                borderColor: 'divider',
                                color: 'text.secondary',
                            }}
                            aria-label="Decrease"
                        />
                    }
                >
                    <RemoveIcon fontSize="small" />
                </BaseNumberField.Decrement>

                {/* 入力エリア */}
                <BaseNumberField.Input
                    render={
                        <OutlinedInput
                            label={label}
                            size={size}
                            sx={{
                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' }, // 枠線を消す
                                '& .MuiOutlinedInput-input': {
                                    textAlign: 'center',
                                    p: '4px 0',
                                    width: '40px',
                                    fontWeight: 'bold',
                                },
                            }}
                        />
                    }
                    aria-label={ariaLabel}
                />

                {/* 増やすボタン */}
                <BaseNumberField.Increment
                    render={
                        <Button
                            variant="text"
                            size={size}
                            sx={{
                                minWidth: '32px',
                                width: '32px',
                                p: 0,
                                borderRadius: 0,
                                borderLeft: '1px solid',
                                borderColor: 'divider',
                                color: 'text.secondary',
                            }}
                            aria-label="Increase"
                        />
                    }
                >
                    <AddIcon fontSize="small" />
                </BaseNumberField.Increment>
            </Box>
        </BaseNumberField.Root>
    );
}