import React, { type ChangeEvent, type ReactElement } from 'react';
import {
  INVOICE_PILOT_CURRENCIES,
  inspectInvoiceCurrencyBasis,
  type InvoiceCurrencyBasis,
  type InvoicePilotCurrency,
} from '../../lib/invoice-currency.ts';

const PILOT_CURRENCY_NAMES: Readonly<Record<InvoicePilotCurrency, string>> = Object.freeze({
  ZAR: 'Rand',
  KES: 'Kenyan Shilling',
  GBP: 'Pound Sterling',
  USD: 'US Dollar',
  EUR: 'Euro',
  BRL: 'Brazilian Real',
});

export type InvoiceCurrencyChoiceProps =
  | {
      mode: 'new';
      value: InvoicePilotCurrency | '';
      onChange: (code: InvoicePilotCurrency) => void;
      id?: string;
    }
  | {
      mode: 'locked';
      basis: InvoiceCurrencyBasis;
      id?: string;
    };

/**
 * Invoice currency selector and lock display.
 *
 * Stateless component enforcing strict separation between new invoice selection
 * and saved immutable records. Uses sole native inspector authority for classification.
 * Renders with lang="en" and relies exclusively on existing application theme variables.
 */
export default function InvoiceCurrencyChoice(props: InvoiceCurrencyChoiceProps): ReactElement {
  const inputId = props.id || 'invoice-currency-choice';
  const helpId = `${inputId}-help`;

  if (props.mode === 'locked') {
    const { basis } = props;

    let content: ReactElement;

    // Check legacy basis: must be valid legacy-rand and currency must be strictly ZAR
    if (basis.status === 'legacy-rand' && basis.currency === 'ZAR') {
      content = (
        <div
          data-testid="invoice-currency-locked-legacy"
          style={{
            minHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--border)',
            fontSize: '15px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          }}
        >
          <span>Historical rand invoice — currency unchanged</span>
        </div>
      );
    } else if (basis.status === 'recorded') {
      // Validate recorded currency using the single native inspector authority
      const inspected = inspectInvoiceCurrencyBasis({ currencyCode: basis.currency });
      if (inspected.status === 'recorded') {
        const name = PILOT_CURRENCY_NAMES[inspected.currency];
        content = (
          <div
            data-testid="invoice-currency-locked-recorded"
            style={{
              minHeight: '48px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-1)',
              border: '1px solid var(--border)',
              fontSize: '15px',
              fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {inspected.currency} — {name}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Currency cannot be changed on this saved record.
            </span>
          </div>
        );
      } else {
        content = (
          <div
            data-testid="invoice-currency-locked-held"
            style={{
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-1)',
              border: '1px solid var(--gold, var(--border))',
              fontSize: '15px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            }}
          >
            <span>Currency needs review</span>
          </div>
        );
      }
    } else {
      // basis.status === 'held' or any malformed basis (e.g. legacy-rand with non-ZAR currency)
      content = (
        <div
          data-testid="invoice-currency-locked-held"
          style={{
            minHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--gold, var(--border))',
            fontSize: '15px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          }}
        >
          <span>Currency needs review</span>
        </div>
      );
    }

    return (
      <div lang="en" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span
          id={inputId}
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          }}
        >
          Currency for this invoice
        </span>
        {content}
      </div>
    );
  }

  // mode === 'new'
  const { value, onChange } = props;

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    const inspected = inspectInvoiceCurrencyBasis({ currencyCode: raw });
    if (inspected.status === 'recorded') {
      onChange(inspected.currency);
    }
  };

  return (
    <div lang="en" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        htmlFor={inputId}
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        Currency for this invoice
      </label>
      <select
        id={inputId}
        value={value}
        onChange={handleChange}
        aria-describedby={helpId}
        style={{
          minHeight: '48px',
          height: '48px',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-1)',
          color: 'var(--text-primary)',
          fontSize: '15px',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <option value="" disabled>
          Choose invoice currency
        </option>
        {INVOICE_PILOT_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code} — {PILOT_CURRENCY_NAMES[code]}
          </option>
        ))}
      </select>
      <span
        id={helpId}
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        Choose the currency agreed with the buyer. Changing this choice does not convert amounts.
      </span>
    </div>
  );
}
