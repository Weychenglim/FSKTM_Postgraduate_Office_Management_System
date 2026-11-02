import React, { Children, Fragment, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';

type PortalSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'>;

function textContent(children: React.ReactNode): string {
  return Children.toArray(children).map(child => isValidElement<{ children?: React.ReactNode }>(child)
    ? textContent(child.props.children) : String(child)).join('');
}

function menuOptions(children: React.ReactNode, groupDisabled = false): SelectMenuOption[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<React.OptionHTMLAttributes<HTMLOptionElement> & { children?: React.ReactNode }>(child)) return [];
    if (child.type === Fragment || child.type === 'optgroup') return menuOptions(child.props.children, groupDisabled || !!child.props.disabled);
    if (child.type !== 'option') return [];
    if (child.props.hidden) return [];
    const label = textContent(child.props.children);
    return [{ value: String(child.props.value ?? label), label, disabled: groupDisabled || child.props.disabled }];
  });
}

/** Keeps existing native change handlers, browser validation and FormData values,
 * while SelectMenu owns the visible, keyboard-accessible control and popup. */
export function PortalSelect({ children, className = '', id, value, defaultValue, onChange, onInvalid, disabled, required, title, ...props }: PortalSelectProps) {
  const generatedId = useId();
  const controlId = id ?? `select-${generatedId}`;
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = menuOptions(children);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => String(defaultValue ?? options.find(option => !option.disabled)?.value ?? ''));
  const [invalid, setInvalid] = useState(false);
  const [accessibleLabel, setAccessibleLabel] = useState<string>();
  const selectedValue = value === undefined ? uncontrolledValue : String(value);

  useEffect(() => {
    const button = trigger.current;
    if (!button || props['aria-label'] || props['aria-labelledby']) return;
    // Label only the field name, excluding the selected value inside wrapping labels.
    const label = button.labels?.[0] ?? button.parentElement?.querySelector(':scope > label') ?? button.parentElement?.parentElement?.querySelector(':scope > label');
    if (!label) return;
    const fieldName = Array.from(label.childNodes).filter(node => node !== button && node !== native.current && !(node instanceof Element && node.contains(button)))
      .map(node => node.textContent).join(' ').trim();
    if (!fieldName) return;
    setAccessibleLabel(fieldName);
  }, [controlId, props['aria-label'], props['aria-labelledby']]);

  useEffect(() => {
    const form = native.current?.form;
    const reset = () => queueMicrotask(() => {
      if (native.current) setUncontrolledValue(native.current.value);
      setInvalid(false);
    });
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, []);

  return <>
    <SelectMenu
      id={controlId}
      controlRef={trigger}
      value={selectedValue}
      options={options}
      disabled={disabled}
      title={title}
      size={className.includes('form-control-sm') ? 'sm' : 'md'}
      className={`portal-select-trigger ${className} ${invalid ? 'form-control-error' : ''}`}
      aria-label={props['aria-label'] ?? accessibleLabel}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={[props['aria-describedby'], invalid ? `${controlId}-error` : undefined].filter(Boolean).join(' ') || undefined}
      aria-required={required}
      aria-invalid={props['aria-invalid'] ?? (invalid || undefined)}
      onChange={nextValue => {
        const element = native.current;
        if (!element || element.matches(':disabled')) return;
        element.value = nextValue;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }}
    />
    {/* Keep the button first so wrapping labels activate it, never the hidden select. */}
    <select
      {...props}
      ref={native}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      disabled={disabled}
      required={required}
      aria-hidden="true"
      tabIndex={-1}
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', pointerEvents: 'none' }}
      onChange={event => {
        setUncontrolledValue(event.currentTarget.value);
        setInvalid(false);
        onChange?.(event);
      }}
      onInvalid={event => {
        event.preventDefault();
        setInvalid(true);
        if (!event.currentTarget.form?.querySelector(':invalid') || event.currentTarget.form.querySelector(':invalid') === event.currentTarget) trigger.current?.focus();
        onInvalid?.(event);
      }}
    >{children}</select>
    {invalid && <span id={`${controlId}-error`} role="alert" className="card-description mt-1 block text-rose-600">Please select an option.</span>}
  </>;
}
