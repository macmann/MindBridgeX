import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppShell from '../../../../../components/dashboard/AppShell.jsx';
import { getDashboardContext } from '../../../../../lib/dashboard-context.js';
import prisma from '../../../../../lib/prisma.js';

function withProjectHref(base, projectId) {
  if (!projectId) return base;
  const url = new URL(base, 'https://placeholder.local');
  url.searchParams.set('projectId', projectId);
  return `${url.pathname}${url.search ? url.search : ''}`;
}

function DetailRow({ label, value }) {
  return (
    <div className="field">
      <p className="muted-label" style={{ marginBottom: '0.25rem' }}>
        {label}
      </p>
      <div>{value || '—'}</div>
    </div>
  );
}

export default async function ViewMcpToolPage({ params, searchParams }) {
  const serverId = Number(params?.serverId);
  const toolId = Number(params?.toolId);

  if (!serverId || !toolId) {
    notFound();
  }

  const { session, userId, projects, activeProjectId } = await getDashboardContext(searchParams);

  const tool = await prisma.mcpTool.findFirst({
    where: { id: toolId, serverId },
    include: { server: true },
  });

  if (!tool || tool.server.userId !== userId) {
    notFound();
  }

  const projectId = tool.server.projectId || activeProjectId;
  const listHref = withProjectHref(`/mcp-servers/${serverId}/tools`, projectId);
  const editHref = withProjectHref(`/mcp-servers/${serverId}/tools/${toolId}/edit`, projectId);

  return (
    <AppShell session={session} projects={projects} activeProjectId={projectId}>
      <section className="section-card">
        <header>
          <div>
            <h2>{tool.name}</h2>
            <p>View configured MCP tool details.</p>
          </div>
          <div className="inline" style={{ gap: '0.5rem' }}>
            <Link className="btn secondary" href={listHref}>
              Back to tools
            </Link>
            <Link className="btn" href={editHref}>
              Edit tool
            </Link>
          </div>
        </header>

        <div className="form-grid">
          <div className="form-section">
            <DetailRow label="Description" value={tool.description} />
            <DetailRow label="HTTP method" value={<span className="badge">{tool.httpMethod}</span>} />
            <DetailRow label="Path template" value={<code>{tool.pathTemplate || '—'}</code>} />
          </div>
          <div className="form-section">
            <DetailRow label="Base URL" value={tool.baseUrl || tool.server.baseUrl || '—'} />
            <DetailRow
              label="Status"
              value={<span className={`badge ${tool.enabled ? 'success' : 'muted'}`}>{tool.enabled ? 'Enabled' : 'Disabled'}</span>}
            />
            <DetailRow label="Updated" value={new Date(tool.updatedAt).toLocaleString()} />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
