import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppShell from '../../../../components/dashboard/AppShell.jsx';
import DeleteMcpToolButton from '../../../../components/mcp/DeleteMcpToolButton.jsx';
import { getDashboardContext } from '../../../../lib/dashboard-context.js';
import prisma from '../../../../lib/prisma.js';
import { describeSource } from '../../../../lib/tool-utils.js';

function withProjectHref(base, projectId) {
  if (!projectId) return base;
  const url = new URL(base, 'https://placeholder.local');
  url.searchParams.set('projectId', projectId);
  return `${url.pathname}${url.search ? url.search : ''}`;
}

function sourceLabel(schemaMeta) {
  if (!schemaMeta || !schemaMeta.type) return 'Custom';
  switch (schemaMeta.type) {
    case 'mock-route':
      return 'Internal route';
    case 'openapi':
      return 'OpenAPI';
    default:
      return 'Custom';
  }
}

export default async function McpToolsPage({ params, searchParams }) {
  const { session, userId, projects, activeProjectId } = await getDashboardContext(searchParams);
  const serverId = Number(params?.serverId);
  if (!serverId) {
    notFound();
  }

  const server = await prisma.mcpServer.findFirst({ where: { id: serverId, userId } });
  if (!server) {
    notFound();
  }

  const tools = await prisma.mcpTool.findMany({
    where: { serverId: server.id },
    orderBy: { updatedAt: 'desc' },
  });

  const projectId = server.projectId || activeProjectId;
  const addToolsHref = withProjectHref(`/mcp-servers/${server.id}/tools/new`, projectId);
  const backHref = withProjectHref('/mcp-servers', projectId);
  const mcpPath = `/mcp/${server.slug}`;

  return (
    <AppShell session={session} projects={projects} activeProjectId={projectId}>
      <section className="section-card">
        <header>
          <div>
            <h2>Tools for {server.name}</h2>
            <p>
              Slug <code>{server.slug}</code> · MCP path <code>{mcpPath}</code>
            </p>
          </div>
          <div className="inline" style={{ gap: '0.5rem' }}>
            <Link className="btn secondary" href={backHref}>
              Back to servers
            </Link>
            <Link className="btn" href={addToolsHref}>
              Add tools
            </Link>
          </div>
        </header>
        {tools.length === 0 ? (
          <div className="empty-state">
            <p>No tools yet.</p>
            <p>Create tools from internal routes or import an OpenAPI spec.</p>
            <Link className="btn" href={addToolsHref}>
              Configure tools
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Source</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Base URL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => {
                  const meta = describeSource(tool.inputSchema);
                  const viewHref = withProjectHref(`/mcp-servers/${server.id}/tools/${tool.id}`, projectId);
                  const editHref = withProjectHref(`/mcp-servers/${server.id}/tools/${tool.id}/edit`, projectId);
                  return (
                    <tr key={tool.id}>
                      <td>
                        <strong>{tool.name}</strong>
                      </td>
                      <td>{tool.description || '—'}</td>
                      <td>
                        <span className="badge muted">{sourceLabel(meta)}</span>
                      </td>
                      <td>
                        <span className="badge">{tool.httpMethod}</span>
                      </td>
                      <td>
                        <code>{tool.pathTemplate || '—'}</code>
                      </td>
                      <td>{tool.baseUrl || '—'}</td>
                      <td>
                        <div className="table-actions">
                          <Link className="table-action" href={viewHref}>
                            View
                          </Link>
                          <Link className="table-action" href={editHref}>
                            Edit
                          </Link>
                          <DeleteMcpToolButton serverId={server.id} toolId={tool.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
