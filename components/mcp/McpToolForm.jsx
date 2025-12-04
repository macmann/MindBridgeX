'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function toBoolean(value) {
  return value === true || value === 'true' || value === 'on';
}

export default function McpToolForm({ serverId, projectId, initialTool }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    payload.enabled = toBoolean(payload.enabled);

    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/mcp-servers/${serverId}/tools/${initialTool?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.error || 'Unable to update MCP tool');
        return;
      }

      const nextProjectId = searchParams.get('projectId') || projectId || initialTool?.server?.projectId;
      const listUrl = nextProjectId
        ? `/mcp-servers/${serverId}/tools?projectId=${nextProjectId}`
        : `/mcp-servers/${serverId}/tools`;
      router.push(listUrl);
      router.refresh();
    } catch (err) {
      console.error('Failed to update MCP tool', err);
      setMessage('Unable to update MCP tool');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-section">
          <h3>Tool identity</h3>
          <p>Adjust the public-facing name and description for this tool.</p>
          <div className="field">
            <label htmlFor="tool-name">Name</label>
            <input
              id="tool-name"
              name="name"
              placeholder="tool_name"
              defaultValue={initialTool?.name || ''}
              required
            />
            <p className="helper-text">Lowercase with underscores is recommended. We’ll normalize the name.</p>
          </div>
          <div className="field">
            <label htmlFor="tool-description">Description</label>
            <textarea
              id="tool-description"
              name="description"
              rows={3}
              placeholder="Optional description"
              defaultValue={initialTool?.description || ''}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Request mapping</h3>
          <p>Control how the MCP runtime routes requests to your upstream service.</p>
          <div className="field">
            <label htmlFor="tool-method">HTTP method</label>
            <select id="tool-method" name="httpMethod" defaultValue={initialTool?.httpMethod || 'GET'}>
              {HTTP_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tool-path">Path template</label>
            <input
              id="tool-path"
              name="pathTemplate"
              placeholder="/api/resource/{id}"
              defaultValue={initialTool?.pathTemplate || ''}
            />
            <p className="helper-text">Path params should use curly braces (e.g. {'{id}'}).</p>
          </div>
          <div className="field">
            <label htmlFor="tool-base-url">Base URL</label>
            <input
              id="tool-base-url"
              name="baseUrl"
              placeholder="http://localhost:3000"
              defaultValue={initialTool?.baseUrl || initialTool?.server?.baseUrl || ''}
            />
            <p className="helper-text">Defaults to the MCP server base URL when left blank.</p>
          </div>
          <label className="field" style={{ flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
            <input type="checkbox" name="enabled" defaultChecked={initialTool ? initialTool.enabled : true} /> Enable
            this tool
          </label>
        </div>
      </div>

      {message ? <p className="error">{message}</p> : null}
      <button className="btn" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
