'use client';

import { useCallback, useState } from 'react';

export default function ApiKeyField({ label = 'API key', value, helperText, hideValue = false }) {
  const [copied, setCopied] = useState(false);
  const displayValue = value ? (hideValue ? '••••••••••••••••' : value) : 'Not required';
  const canCopy = Boolean(value);

  const handleCopy = useCallback(async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [canCopy, value]);

  return (
    <div className="api-key-field">
      <div>
        <p className="label">{label}</p>
        {helperText ? <p className="helper-text">{helperText}</p> : null}
      </div>
      <div className="api-key-field__value">
        <code>{displayValue}</code>
        <button className="btn ghost" type="button" onClick={handleCopy} disabled={!canCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
