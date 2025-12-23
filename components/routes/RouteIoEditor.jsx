'use client';

import { useMemo, useState } from 'react';

function headersToList(map) {
  if (!map || typeof map !== 'object') return [{ key: '', value: '' }];
  const entries = Object.entries(map);
  return entries.length ? entries.map(([key, value]) => ({ key, value: String(value ?? '') })) : [{ key: '', value: '' }];
}

function listToHeaders(list) {
  const headers = {};
  for (const row of list) {
    const key = String(row.key || '').trim();
    if (!key) continue;
    headers[key] = row.value;
  }
  return headers;
}

function fieldsToList(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ path: '', type: 'string', label: '' }];
  }

  return value.map((field) => ({
    path: String(field?.path || ''),
    type: field?.type || 'string',
    label: field?.label || '',
  }));
}

function listToFields(list) {
  return list
    .map((field) => {
      const path = String(field?.path || '').trim();
      if (!path) return null;
      const clean = { path, type: field?.type || 'string' };
      const label = String(field?.label || '').trim();
      if (label) clean.label = label;
      return clean;
    })
    .filter(Boolean);
}

export default function RouteIoEditor({ route }) {
  const [responseStatus, setResponseStatus] = useState(route.responseStatus || 200);
  const [responseBody, setResponseBody] = useState(route.responseBody || '');
  const [responseIsJson, setResponseIsJson] = useState(Boolean(route.responseIsJson));
  const [responseHeaders, setResponseHeaders] = useState(headersToList(route.responseHeaders));
  const [requestSampleBody, setRequestSampleBody] = useState(route.requestSampleBody || '');
  const [requestSchema, setRequestSchema] = useState(
    route.requestSchema ? JSON.stringify(route.requestSchema, null, 2) : ''
  );
  const [responseFields, setResponseFields] = useState(fieldsToList(route.responseFieldsJson));
  const [message, setMessage] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [responseFieldsMessage, setResponseFieldsMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [savingResponseFields, setSavingResponseFields] = useState(false);
  const isDatasetMode = route.responseMode === 'DATASET_LOOKUP';

  const showResponse = useMemo(() => ['GET'].includes(String(route.method || '').toUpperCase()), [route.method]);
  const showRequest = useMemo(() => ['POST'].includes(String(route.method || '').toUpperCase()), [route.method]);

  const updateHeader = (idx, key, value) => {
    setResponseHeaders((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      if (copy[copy.length - 1]?.key && copy[copy.length - 1]?.value) {
        copy.push({ key: '', value: '' });
      }
      return copy;
    });
  };

  const updateField = (idx, key, value) => {
    setResponseFields((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  };

  const addFieldRow = () => {
    setResponseFields((prev) => [...prev, { path: '', type: 'string', label: '' }]);
  };

  const removeFieldRow = (idx) => {
    setResponseFields((prev) => {
      if (prev.length === 1) {
        return [{ path: '', type: 'string', label: '' }];
      }
      return prev.filter((_, index) => index !== idx);
    });
  };

  const handleSaveResponse = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        id: route.id,
        responseStatus: Number(responseStatus) || 200,
        responseBody,
        responseIsJson,
        responseHeaders: listToHeaders(responseHeaders),
      };
      const res = await fetch('/api/mock-routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to save response');
      }
      setMessage('Response settings saved');
    } catch (err) {
      setMessage(err?.message || 'Unable to save response');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRequest = async () => {
    setSavingRequest(true);
    setRequestMessage('');
    try {
      const payload = {
        id: route.id,
        requestSampleBody,
        requestSchema: requestSchema?.trim() ? requestSchema : null,
      };
      const res = await fetch('/api/mock-routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to save request shape');
      }
      setRequestMessage('Request shape saved');
    } catch (err) {
      setRequestMessage(err?.message || 'Unable to save request shape');
    } finally {
      setSavingRequest(false);
    }
  };

  const handleSaveResponseFields = async () => {
    setSavingResponseFields(true);
    setResponseFieldsMessage('');
    try {
      const payload = {
        id: route.id,
        responseFieldsJson: listToFields(responseFields),
      };
      const res = await fetch('/api/mock-routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to save response fields');
      }
      setResponseFieldsMessage('Response fields saved');
    } catch (err) {
      setResponseFieldsMessage(err?.message || 'Unable to save response fields');
    } finally {
      setSavingResponseFields(false);
    }
  };

  return (
    <div className="detail-stack">
      {showResponse ? (
        <section className="surface-card">
          <header className="section-heading">
            <div>
              <h3>Response editor</h3>
              <p className="helper-text">
                {isDatasetMode
                  ? 'Dataset lookup responses return the matching dataset JSON; status and headers still apply.'
                  : 'Set the status, headers, and body returned by this route.'}
              </p>
            </div>
          </header>
          <div className="form-grid">
            <label className="field">
              <span>Status code</span>
              <input
                type="number"
                min="100"
                max="599"
                value={responseStatus}
                onChange={(e) => setResponseStatus(e.target.value)}
              />
            </label>
            <label className="field" style={{ alignItems: 'center', flexDirection: 'row', gap: '8px' }}>
              <input
                type="checkbox"
                checked={responseIsJson}
                onChange={(e) => setResponseIsJson(e.target.checked)}
              />
              <span>Format as JSON</span>
            </label>
          </div>
          <div className="field">
            <span>Response headers</span>
            {responseHeaders.map((row, idx) => (
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }} key={idx}>
                <input
                  placeholder="Header name"
                  value={row.key}
                  onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                />
                <input
                  placeholder="Header value"
                  value={row.value}
                  onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="field">
            <span>Response body</span>
            <textarea
              rows={8}
              value={responseBody}
              onChange={(e) => setResponseBody(e.target.value)}
              placeholder={`{\n  "message": "ok"\n}`}
            />
          </div>
          {message ? <p className={message.toLowerCase().includes('unable') ? 'error' : 'helper-text'}>{message}</p> : null}
          <button className="btn" type="button" onClick={handleSaveResponse} disabled={saving}>
            {saving ? 'Saving…' : 'Save response'}
          </button>
        </section>
      ) : null}

      {showResponse ? (
        <section className="surface-card">
          <header className="section-heading">
            <div>
              <h3>Response fields (for Dataset UI)</h3>
              <p className="helper-text">
                Describe the fields returned in dataset responses so the UI can show friendly labels.
              </p>
            </div>
          </header>

          <div className="field">
            <span>Fields</span>
            <div className="detail-stack">
              {responseFields.map((field, idx) => (
                <div
                  className="form-grid"
                  style={{ gridTemplateColumns: '2fr 1fr 2fr 90px', alignItems: 'center' }}
                  key={idx}
                >
                  <input
                    placeholder="Field path (e.g., flightNo)"
                    value={field.path}
                    onChange={(e) => updateField(idx, 'path', e.target.value)}
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(idx, 'type', e.target.value)}
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="date">date</option>
                    <option value="datetime">datetime</option>
                  </select>
                  <input
                    placeholder="Label (optional)"
                    value={field.label}
                    onChange={(e) => updateField(idx, 'label', e.target.value)}
                  />
                  <button className="btn secondary" type="button" onClick={() => removeFieldRow(idx)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="form-grid" style={{ alignItems: 'center' }}>
            <button className="btn secondary" type="button" onClick={addFieldRow}>
              Add field
            </button>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" type="button" onClick={handleSaveResponseFields} disabled={savingResponseFields}>
                {savingResponseFields ? 'Saving…' : 'Save response fields'}
              </button>
            </div>
          </div>
          {responseFieldsMessage ? (
            <p
              className={
                responseFieldsMessage.toLowerCase().includes('unable') ? 'error' : 'helper-text'
              }
            >
              {responseFieldsMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {showRequest ? (
        <section className="surface-card">
          <header className="section-heading">
            <div>
              <h3>Request example</h3>
              <p className="helper-text">Capture the sample payload callers should send.</p>
            </div>
          </header>
          <div className="field">
            <span>Sample request body</span>
            <textarea
              rows={8}
              value={requestSampleBody}
              onChange={(e) => setRequestSampleBody(e.target.value)}
              placeholder={`{\n  "name": "Example"\n}`}
            />
          </div>
          <div className="field">
            <span>Request schema (optional)</span>
            <textarea
              rows={6}
              value={requestSchema}
              onChange={(e) => setRequestSchema(e.target.value)}
              placeholder={`{\n  "type": "object",\n  "properties": { "name": { "type": "string" } }\n}`}
            />
            <p className="helper-text">Provide JSON Schema to show in the UI and future API docs.</p>
          </div>
          {requestMessage ? (
            <p className={requestMessage.toLowerCase().includes('unable') ? 'error' : 'helper-text'}>{requestMessage}</p>
          ) : null}
          <button className="btn" type="button" onClick={handleSaveRequest} disabled={savingRequest}>
            {savingRequest ? 'Saving…' : 'Save request sample'}
          </button>
        </section>
      ) : null}
    </div>
  );
}
