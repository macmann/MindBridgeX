'use client';

import { useState } from 'react';

function formatPreview(value) {
  try {
    const json = JSON.stringify(value, null, 2);
    return json.length > 160 ? `${json.slice(0, 157)}...` : json;
  } catch (error) {
    return String(value);
  }
}

export default function RouteDatasetManager({
  routeId,
  routeMethod,
  routePath,
  lookupParamName,
  initialRecords,
}) {
  const [records, setRecords] = useState(initialRecords || []);
  const [keyInput, setKeyInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setKeyInput('');
    setValueInput('');
    setEnabled(true);
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setKeyInput(record.key);
    setEnabled(Boolean(record.enabled));
    try {
      setValueInput(JSON.stringify(record.valueJson, null, 2));
    } catch (error) {
      setValueInput(String(record.valueJson ?? ''));
    }
    setStatus('idle');
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('idle');
    setMessage('');

    const trimmedKey = keyInput.trim();
    if (!trimmedKey) {
      setStatus('error');
      setMessage('Key is required.');
      return;
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(valueInput.trim());
    } catch (error) {
      setStatus('error');
      setMessage('Value must be valid JSON.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = { key: trimmedKey, valueJson: parsedJson, enabled };
      const isEditing = Boolean(editingId);
      const endpoint = isEditing
        ? `/api/routes/${routeId}/dataset/${editingId}`
        : `/api/routes/${routeId}/dataset`;
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus('error');
        setMessage(data?.error || (isEditing ? 'Unable to update record.' : 'Unable to add record.'));
        return;
      }

      const updatedRecord = data?.record;
      if (updatedRecord) {
        setRecords((prev) => {
          const otherRecords = prev.filter((r) => r.id !== updatedRecord.id);
          return [updatedRecord, ...otherRecords];
        });
      }

      setStatus('success');
      setMessage(isEditing ? 'Record updated.' : 'Record added.');
      if (isEditing) {
        setEditingId(null);
      }
      setKeyInput('');
      setValueInput('');
      setEnabled(true);
    } catch (error) {
      console.error('Failed to save dataset record', error);
      setStatus('error');
      setMessage('Unable to save record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (!recordId) return;
    if (!window.confirm('Delete this dataset record?')) return;

    setIsDeletingId(recordId);
    try {
      const response = await fetch(`/api/routes/${routeId}/dataset/${recordId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus('error');
        setMessage(data?.error || 'Unable to delete record.');
        return;
      }
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
      if (editingId === recordId) {
        resetForm();
      }
      setStatus('success');
      setMessage('Record deleted.');
    } catch (error) {
      console.error('Failed to delete dataset record', error);
      setStatus('error');
      setMessage('Unable to delete record.');
    } finally {
      setIsDeletingId('');
    }
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-section">
          <h3>{editingId ? 'Edit record' : 'Add record'}</h3>
          <p>
            Provide a lookup key and JSON payload to return when this route matches.
            {lookupParamName ? ` Lookup param: ${lookupParamName}.` : ''}
          </p>
          {message ? <p className={status === 'error' ? 'error' : 'success'}>{message}</p> : null}
          <div className="field">
            <label htmlFor="dataset-key">Key</label>
            <input
              id="dataset-key"
              name="key"
              required
              placeholder="e.g., booking123"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="dataset-json">JSON value</label>
            <textarea
              id="dataset-json"
              name="valueJson"
              required
              rows={10}
              placeholder={`{
  "message": "Hello"
}`}
              value={valueInput}
              onChange={(event) => setValueInput(event.target.value)}
            />
            <p className="helper-text">Paste any JSON. Objects and arrays are supported.</p>
          </div>
          <label className="field" style={{ flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
            <input
              type="checkbox"
              name="enabled"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enabled
          </label>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button className="btn" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : editingId ? 'Update record' : 'Add record'}
            </button>
            {editingId ? (
              <button className="btn secondary" type="button" onClick={resetForm} disabled={isSaving}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="form-section">
          <h3>Dataset records</h3>
          <p>
            Route <span className="badge">{routeMethod}</span> <code>{routePath}</code>
          </p>
          {records.length === 0 ? (
            <p className="helper-text">No dataset records yet.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Enabled</th>
                    <th>Preview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <code>{record.key}</code>
                      </td>
                      <td>{record.enabled ? 'Yes' : 'No'}</td>
                      <td>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{formatPreview(record.valueJson)}</pre>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="table-action" type="button" onClick={() => handleEdit(record)}>
                            Edit
                          </button>
                          <button
                            className="table-action"
                            type="button"
                            onClick={() => handleDelete(record.id)}
                            disabled={isDeletingId === record.id}
                          >
                            {isDeletingId === record.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
