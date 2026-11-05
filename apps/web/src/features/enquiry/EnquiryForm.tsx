import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  ENQUIRY_LIMITS,
  EnquirySchema,
  type Enquiry,
  type EnquiryInput,
  type Product,
} from '@catalogue/shared';
import { ApiError } from '../../api/client';
import { useCreateEnquiry } from '../../api/queries';
import { FormField } from './FormField';
import styles from './EnquiryPage.module.css';

interface EnquiryFormProps {
  product: Product;
  onSent: (enquiry: Enquiry) => void;
}

const FIELDS = ['name', 'email', 'phone', 'message'] as const;
type FieldName = (typeof FIELDS)[number];
const isField = (path: string): path is FieldName => (FIELDS as readonly string[]).includes(path);

function submitErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.isRateLimited) {
    return 'You have sent several enquiries in a short time. Please wait a minute and try again.';
  }
  if (error instanceof ApiError && error.status === 400) {
    return 'Please check the highlighted fields and try again.';
  }
  if (error instanceof ApiError) return error.message;
  return 'We could not send your enquiry. Please try again.';
}

export function EnquiryForm({ product, onSent }: EnquiryFormProps) {
  const enquiry = useCreateEnquiry();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EnquiryInput, unknown, Enquiry>({
    // Same schema as the API: one source of truth for validation rules and messages.
    resolver: zodResolver(EnquirySchema),
    defaultValues: {
      productId: product.id,
      name: '',
      email: '',
      phone: '',
      message: '',
      website: '',
    },
  });

  const onSubmit = (values: Enquiry) => {
    enquiry.mutate(values, {
      onSuccess: () => onSent(values),
      onError: (error) => {
        // Surface server-side field errors inline; the typed values are kept either way.
        if (error instanceof ApiError) {
          for (const detail of error.details) {
            if (isField(detail.path)) setError(detail.path, { message: detail.message });
          }
        }
      },
    });
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
    >
      <input type="hidden" {...register('productId')} />

      <FormField
        id="enquiry-name"
        label="Name"
        autoComplete="name"
        maxLength={ENQUIRY_LIMITS.name}
        registration={register('name')}
        error={errors.name?.message}
      />
      <FormField
        id="enquiry-email"
        label="Email"
        type="email"
        autoComplete="email"
        maxLength={ENQUIRY_LIMITS.email}
        registration={register('email')}
        error={errors.email?.message}
      />
      <FormField
        id="enquiry-phone"
        label="Phone"
        type="tel"
        autoComplete="tel"
        optional
        maxLength={ENQUIRY_LIMITS.phone}
        registration={register('phone')}
        error={errors.phone?.message}
      />
      <FormField
        id="enquiry-message"
        label="Message"
        multiline
        optional
        hint="Questions about sizing, availability or delivery are welcome."
        maxLength={ENQUIRY_LIMITS.message}
        registration={register('message')}
        error={errors.message?.message}
      />

      {/* Honeypot: invisible to people and assistive tech; bots tend to fill every field. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="enquiry-website">Website</label>
        <input
          id="enquiry-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('website')}
        />
      </div>

      {enquiry.isError && (
        <p className={styles.submitError} role="alert">
          {submitErrorMessage(enquiry.error)}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={enquiry.isPending}>
        {enquiry.isPending ? 'Sending…' : 'Send enquiry'}
      </button>

      <p className={styles.privacy}>We will use these details only to respond to your enquiry.</p>
    </form>
  );
}
