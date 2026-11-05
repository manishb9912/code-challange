import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import styles from './EnquiryPage.module.css';

interface FieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string | undefined;
  hint?: string;
  optional?: boolean;
}

type InputFieldProps = FieldProps & { multiline?: false } & InputHTMLAttributes<HTMLInputElement>;
type TextareaFieldProps = FieldProps & {
  multiline: true;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Labelled field with an inline, programmatically associated error message. */
export function FormField(props: InputFieldProps | TextareaFieldProps) {
  const { id, label, registration, error, hint, optional } = props;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  const shared = {
    id,
    className: styles.control,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    ...registration,
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}> (optional)</span>}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {props.multiline ? (
        <textarea {...shared} rows={5} maxLength={props.maxLength} />
      ) : (
        <input
          {...shared}
          type={props.type ?? 'text'}
          autoComplete={props.autoComplete}
          maxLength={props.maxLength}
        />
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
