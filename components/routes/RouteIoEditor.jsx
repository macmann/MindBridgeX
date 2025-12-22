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

export default function RouteIoEditor({ route }) {
  const [responseStatus, setResponseStatus] = useState(route.responseStatus || 200);
  const [responseBody, setResponseBody] = useState(route.responseBody || '');
  const [responseIsJson, setResponseIsJson] = useState(Boolean(route.responseIsJson));
  const [responseHeaders, setResponseHeaders] = useState(headersToList(route.responseHeaders));
  const [requestSampleBody, setRequestSampleBody] = useState(route.requestSampleBody || '');
  const [requestSchema, setRequestSchema] = useState(
    route.requestSchema ? JSON.stringify(route.requestSchema, null, 2) : ''
  );
  const [message, setMessage] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
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
