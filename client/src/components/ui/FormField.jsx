// client/src/components/ui/FormField.jsx
// Fixes: input fields need click each time when entering characters.
// Root cause: inline component definitions inside render cause remounts on every keystroke.
// Solution: export stable, memoized field components used across registration forms.

import React, { memo, forwardRef } from 'react';

/**
 * Stable text / tel / email / password input.
 * NEVER define this inline inside another component — always import it.
 */
export const InputField = memo(forwardRef(({
    label, type = 'text', placeholder, value, onChange,
    disabled = false, required = false, maxLength,
    icon: Icon, suffix, hint, error, className = '',
    inputClassName = '',
}, ref) => (
    <div className={`space-y-1 ${className}`}>
        {label && (
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-1">*</span>}
            </label>
        )}
        <div className="relative">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon size={16} className="text-orange-400" />
                </div>
            )}
            <input
                ref={ref}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                disabled={disabled}
                required={required}
                maxLength={maxLength}
                className={`
                    w-full border rounded-xl py-3 bg-orange-50/60 text-gray-800
                    placeholder-gray-400 transition-all duration-200
                    focus:ring-2 focus:ring-orange-400 focus:border-orange-400
                    focus:outline-none focus:bg-white
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${Icon ? 'pl-10' : 'pl-4'}
                    ${suffix ? 'pr-20' : 'pr-4'}
                    ${error ? 'border-red-300 bg-red-50/40' : 'border-orange-200'}
                    ${inputClassName}
                `}
            />
            {suffix && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {suffix}
                </div>
            )}
        </div>
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
)));

InputField.displayName = 'InputField';

/**
 * Stable textarea.
 */
export const TextareaField = memo(({
    label, placeholder, value, onChange,
    rows = 4, required = false, hint, error, className = '',
}) => (
    <div className={`space-y-1 ${className}`}>
        {label && (
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-1">*</span>}
            </label>
        )}
        <textarea
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            rows={rows}
            required={required}
            className={`
                w-full border rounded-xl py-3 px-4 bg-orange-50/60 text-gray-800
                placeholder-gray-400 resize-none transition-all duration-200
                focus:ring-2 focus:ring-orange-400 focus:border-orange-400
                focus:outline-none focus:bg-white
                ${error ? 'border-red-300' : 'border-orange-200'}
            `}
        />
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
));

TextareaField.displayName = 'TextareaField';

/**
 * Stable select dropdown.
 */
export const SelectField = memo(({
    label, value, onChange, options = [],
    required = false, placeholder = '-- Select --', hint, error, className = '',
    icon: Icon,
}) => (
    <div className={`space-y-1 ${className}`}>
        {label && (
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {label}{required && <span className="text-red-500 ml-1">*</span>}
            </label>
        )}
        <div className="relative">
            {Icon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon size={16} className="text-orange-400" />
                </div>
            )}
            <select
                value={value}
                onChange={onChange}
                required={required}
                className={`
                    w-full border rounded-xl py-3 bg-orange-50/60 text-gray-800
                    appearance-none transition-all duration-200
                    focus:ring-2 focus:ring-orange-400 focus:border-orange-400
                    focus:outline-none focus:bg-white
                    ${Icon ? 'pl-10' : 'pl-4'} pr-10
                    ${error ? 'border-red-300' : 'border-orange-200'}
                `}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={typeof opt === 'object' ? opt.value : opt}
                            value={typeof opt === 'object' ? opt.value : opt}>
                        {typeof opt === 'object' ? opt.label : opt}
                    </option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
));

SelectField.displayName = 'SelectField';

/**
 * File upload button — stable, no remount on re-render.
 */
export const FileUploadField = memo(({
    label, accept = 'image/*', value, onChange,
    hint, error, className = '', icon: Icon,
}) => (
    <div className={`space-y-1 ${className}`}>
        {label && (
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {label}
            </label>
        )}
        <label className={`
            flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-xl p-3
            transition-all duration-200 hover:border-orange-400 hover:bg-orange-50
            ${error ? 'border-red-300 bg-red-50/30' : 'border-orange-200 bg-orange-50/40'}
        `}>
            {Icon && <Icon size={18} className="text-orange-400 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 truncate">
                    {value ? value.name : 'Click to upload'}
                </p>
                {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
            </div>
            <input
                type="file"
                accept={accept}
                className="hidden"
                onChange={onChange}
            />
        </label>
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
));

FileUploadField.displayName = 'FileUploadField';