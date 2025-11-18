'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { slugifyToolName } from '../../lib/tool-utils.js';

function buildInitialState(routes = []) {
  return routes.reduce((acc, route) => {
    acc[route.id] = {
      selected: false,
      toolName: slugifyToolName(route.name || route.path || `route_${route.id}`),
      description: route.description || '',
    };
    return acc;
  }, {});
}

export default function CreateToolsFromRoutes({ serverId, projectId, routes = [] }) {
  const router = useRouter();
  const [formState, setFormState] = useState(() => buildInitialState(routes));
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projectSuffix = projectId ? `?projectId=${projectId}` : '';
  const selectedCount = useMemo(
    () => Object.values(formState).filter((entry) => entry.selected).length,
    [formState],
  );

  const updateState = (routeId, updates) => {
    setFormState((previous) => ({
      ...previous,
      [routeId]: {
        ...previous[routeId],
        ...updates,
      },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('');
    setError('');

    const payload = Object.entries(formState)
      .filter(([, entry]) => entry.selected)
      .map(([routeId, entry]) => ({
        routeId: Number(routeId),
        toolName: entry.toolName,
        description: entry.description,
      }));

    if (!payload.length) {
      setError('Select at least one route before creating tools.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/mcp-servers/${serverId}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'routes', routes: payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to create tools from routes');
      }
      setStatus(`Created ${data?.created?.length || payload.length} tools.`);
      router.push(`/mcp-servers/${serverId}/tools${projectSuffix}`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="section-card">
      <header>
        <div>
          <h3>From existing routes</h3>
          <p>Select any mock route and instantly turn it into an MCP tool.</p>
        </div>
      </header>
      {routes.length === 0 ? (
        <p className="empty-state">Create routes first, then map them to tools here.</p>
      ) : (
        <form onSubmit={handleSubmit} className="stack">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '2rem' }}></th>
                  <th>Name</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Tool name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => {
                  const state = formState[route.id] || {};
                  return (
                    <tr key={route.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={Boolean(state.selected)}
                          onChange={(event) => updateState(route.id, { selected: event.target.checked })}
                          aria-label={`Select ${route.method} ${route.path}`}
                        />
                      </td>
                      <td>{route.name || 'Untitled route'}</td>
                      <td>
                        <span className="badge">{route.method}</span>
                      </td>
                      <td>
                        <code>{route.path}</code>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={state.toolName || ''}
                          onChange={(event) => updateState(route.id, { toolName: event.target.value })}
                          placeholder="tool_name"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={state.description || ''}
                          onChange={(event) => updateState(route.id, { description: event.target.value })}
                          placeholder="Optional description"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error ? <p className="error">{error}</p> : null}
          {status ? <p className="success">{status}</p> : null}
          <button className="btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : `Create ${selectedCount || ''} tool${selectedCount === 1 ? '' : 's'}`}
          </button>
        </form>
      )}
    </section>
  );
}
