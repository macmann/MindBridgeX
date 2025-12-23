'use client';

import { useEffect, useMemo, useState } from 'react';

const jsonPlaceholder = `{
  "message": "Hello"
}`;

function formatPreview(value) {
  try {
    const json = JSON.stringify(value, null, 2);
    return json.length > 160 ? `${json.slice(0, 157)}...` : json;
  } catch (error) {
    return String(value);
  }
}

function setDeep(obj, path, value) {
  const parts = String(path || '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return obj;

  let current = obj;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }

    if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  });

  return obj;
}

function getDeep(obj, path) {
  const parts = String(path || '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return '';
  }
}

function defaultValueForType(type) {
  if (type === 'boolean') return false;
  return '';
}

function coerceValueForInput(type, value) {
  if (type === 'boolean') return Boolean(value);
  if (value === null || value === undefined) return '';
  return String(value);
}

function parseRowValue(row) {
  const type = row.type || 'string';
  if (!row.path) return { skip: true };

  if (type === 'boolean') {
    return { value: Boolean(row.value) };
  }

  if (type === 'number') {
    if (row.value === '' || row.value === null || row.value === undefined) {
      return { value: null };
    }
    const numeric = Number(row.value);
    if (Number.isNaN(numeric)) {
      throw new Error('Number fields must contain valid numbers.');
    }
    return { value: numeric };
  }

  if (type === 'date' || type === 'datetime') {
    if (row.value === '' || row.value === null || row.value === undefined) {
      return { value: null };
    }
    return { value: String(row.value) };
  }

  return { value: row.value ?? '' };
}

function buildObjectFromRows(rows) {
  const result = {};
  rows.forEach((row) => {
    const { skip, value } = parseRowValue(row);
    if (skip) return;
    setDeep(result, row.path, value);
  });
  return result;
}

function buildRowsFromValue(valueJson, responseFields) {
  const rows = [];
  const fields = Array.isArray(responseFields) ? responseFields : [];
  if (fields.length) {
    fields.forEach((field) => {
      const value = getDeep(valueJson, field.path);
      rows.push({
        path: field.path,
        type: field.type || 'string',
        value: coerceValueForInput(field.type, value),
      });
    });
  }

  if (!rows.length && valueJson && typeof valueJson === 'object' && !Array.isArray(valueJson)) {
    Object.entries(valueJson).forEach(([key, value]) => {
      rows.push({ path: key, type: 'string', value: coerceValueForInput('string', value) });
    });
  }

  if (!rows.length) {
    const firstField = fields[0];
    rows.push({
      path: firstField?.path || '',
      type: firstField?.type || 'string',
      value: defaultValueForType(firstField?.type),
    });
  }

  return rows;
}

export default function RouteDatasetManager({
  routeId,
  routeMethod,
  routePath,
  lookupParamName,
  responseFields,
  initialRecords,
}) {
  const normalizedFields = useMemo(
    () => (Array.isArray(responseFields) ? responseFields.filter((field) => field?.path) : []),
    [responseFields]
  );

  const [records, setRecords] = useState(initialRecords || []);
  const [keyInput, setKeyInput] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState('');
  const [fieldRows, setFieldRows] = useState(() => buildRowsFromValue({}, normalizedFields));
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [advancedJsonText, setAdvancedJsonText] = useState(() =>
    prettyJson(buildObjectFromRows(buildRowsFromValue({}, normalizedFields)))
  );

  useEffect(() => {
    const initialRows = buildRowsFromValue({}, normalizedFields);
    setFieldRows(initialRows);
    setAdvancedJsonText(prettyJson(buildObjectFromRows(initialRows)));
  }, [normalizedFields]);

  const resetForm = () => {
    setEditingId(null);
    setKeyInput('');
    const rows = buildRowsFromValue({}, normalizedFields);
    setFieldRows(rows);
    setAdvancedJsonText(prettyJson(buildObjectFromRows(rows)));
    setEnabled(true);
    setShowAdvancedJson(false);
  };

  const syncJsonFromRows = (rows) => {
    try {
      setAdvancedJsonText(prettyJson(buildObjectFromRows(rows)));
    } catch (error) {
      // ignore sync errors while typing invalid values
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setKeyInput(record.key);
    setEnabled(Boolean(record.enabled));
    const rows = buildRowsFromValue(record.valueJson, normalizedFields);
    setFieldRows(rows);
    setAdvancedJsonText(prettyJson(record.valueJson));
    setShowAdvancedJson(false);
    setStatus('idle');
    setMessage('');
  };

  const handleFieldChange = (index, updated) => {
    setFieldRows((prev) => {
      const next = prev.map((row, idx) => (idx === index ? { ...row, ...updated } : row));
      syncJsonFromRows(next);
      return next;
    });
  };

  const handleAddFieldRow = () => {
    setFieldRows((prev) => {
      const fallback = normalizedFields[0];
      const next = [
        ...prev,
        {
          path: fallback?.path || '',
          type: fallback?.type || 'string',
          value: defaultValueForType(fallback?.type),
        },
      ];
      syncJsonFromRows(next);
      return next;
    });
  };

  const handleRemoveFieldRow = (index) => {
    setFieldRows((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      const ensured = next.length ? next : buildRowsFromValue({}, normalizedFields);
      syncJsonFromRows(ensured);
      return ensured;
    });
  };

  const handleAdvancedJsonToggle = (event) => {
    const checked = event.target.checked;
    setShowAdvancedJson(checked);
    if (checked) {
      setAdvancedJsonText(prettyJson(buildObjectFromRows(fieldRows)));
    } else {
      try {
        const parsed = JSON.parse(advancedJsonText || '{}');
        const rows = buildRowsFromValue(parsed, normalizedFields);
        setFieldRows(rows);
      } catch (error) {
        setStatus('error');
        setMessage('Advanced JSON must be valid JSON to switch back.');
        setShowAdvancedJson(true);
      }
    }
  };

  const handleAdvancedJsonChange = (event) => {
    const text = event.target.value;
    setAdvancedJsonText(text);
    try {
      const parsed = JSON.parse(text);
      const rows = buildRowsFromValue(parsed, normalizedFields);
      setFieldRows(rows);
      setStatus('idle');
      setMessage('');
    } catch (error) {
      // ignore parse errors while typing
    }
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

    let valueJson;
    if (showAdvancedJson) {
      try {
        valueJson = JSON.parse((advancedJsonText || '').trim() || '{}');
      } catch (error) {
        setStatus('error');
        setMessage('Value must be valid JSON.');
        return;
      }
    } else {
      try {
        valueJson = buildObjectFromRows(fieldRows);
      } catch (error) {
        setStatus('error');
        setMessage(error.message || 'Unable to build JSON value.');
        return;
      }
      setAdvancedJsonText(prettyJson(valueJson));
    }

    setIsSaving(true);
    try {
      const payload = { key: trimmedKey, valueJson, enabled };
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
      const rows = buildRowsFromValue({}, normalizedFields);
      setFieldRows(rows);
      setAdvancedJsonText(prettyJson(buildObjectFromRows(rows)));
      setEnabled(true);
      setShowAdvancedJson(false);
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
            Provide a lookup key and fill in the fields returned when this route matches.
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Response fields (for Dataset UI)</label>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 400 }}>
                <input type="checkbox" checked={showAdvancedJson} onChange={handleAdvancedJsonToggle} />
                Advanced JSON
              </label>
            </div>

            {!showAdvancedJson ? (
              <div className="table-wrapper" style={{ marginTop: '12px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Field</th>
                      <th>Value</th>
                      <th style={{ width: '80px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldRows.map((row, index) => (
                      <tr key={`field-row-${index}`}>
                        <td>
                          {normalizedFields.length ? (
                            <select
                              value={row.path}
                              onChange={(event) => {
                                const selectedPath = event.target.value;
                                const selectedField = normalizedFields.find((field) => field.path === selectedPath);
                                handleFieldChange(index, {
                                  path: selectedPath,
                                  type: selectedField?.type || row.type,
                                  value:
                                    row.value === '' || row.value === undefined
                                      ? defaultValueForType(selectedField?.type)
                                      : row.value,
                                });
                              }}
                            >
                              <option value="">Select a field</option>
                              {normalizedFields.map((field) => (
                                <option key={field.path} value={field.path}>
                                  {field.label || field.path} ({field.type || 'string'})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              placeholder="Field path"
                              value={row.path}
                              onChange={(event) => handleFieldChange(index, { path: event.target.value })}
                            />
                          )}
                        </td>
                        <td>
                          {row.type === 'boolean' ? (
                            <label style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(row.value)}
                                onChange={(event) => handleFieldChange(index, { value: event.target.checked })}
                              />
                              {row.value ? 'True' : 'False'}
                            </label>
                          ) : (
                            <input
                              type={row.type === 'number' ? 'number' : row.type === 'date' ? 'date' : row.type === 'datetime' ? 'datetime-local' : 'text'}
                              value={row.value}
                              onChange={(event) => handleFieldChange(index, { value: event.target.value })}
                              placeholder={row.type === 'number' ? '0' : row.type === 'date' ? '2024-01-01' : row.type === 'datetime' ? '2024-01-01T12:00' : 'Enter value'}
                            />
                          )}
                        </td>
                        <td>
                          <button className="table-action" type="button" onClick={() => handleRemoveFieldRow(index)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="btn secondary" style={{ marginTop: '8px' }} onClick={handleAddFieldRow}>
                  Add field
                </button>
                {normalizedFields.length === 0 ? (
                  <p className="helper-text" style={{ marginTop: '8px' }}>
                    No response fields defined for this route. Add fields in the route editor or use Advanced JSON.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="field" style={{ marginTop: '12px' }}>
                <textarea
                  id="dataset-json"
                  name="valueJson"
                  rows={10}
                  placeholder={jsonPlaceholder}
                  value={advancedJsonText}
                  onChange={handleAdvancedJsonChange}
                />
                <p className="helper-text">Edit the JSON directly. Changes stay in sync with the field table.</p>
              </div>
            )}
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
