import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppShell from '../../../../../../components/dashboard/AppShell.jsx';
import McpToolForm from '../../../../../../components/mcp/McpToolForm.jsx';
import { getDashboardContext } from '../../../../../../lib/dashboard-context.js';
import prisma from '../../../../../../lib/prisma.js';

function withProjectHref(base, projectId) {
  if (!projectId) return base;
  const url = new URL(base, 'https://placeholder.local');
  url.searchParams.set('projectId', projectId);
  return `${url.pathname}${url.search ? url.search : ''}`;
}

export default async function EditMcpToolPage({ params, searchParams }) {
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
  const backHref = withProjectHref(`/mcp-servers/${serverId}/tools`, projectId);
  const viewHref = withProjectHref(`/mcp-servers/${serverId}/tools/${toolId}`, projectId);
  const toolData = JSON.parse(JSON.stringify(tool));

  return (
    <AppShell session={session} projects={projects} activeProjectId={projectId}>
      <section className="section-card">
        <header>
          <div>
            <h2>Edit MCP tool</h2>
            <p>Update routing details and metadata for {tool.name}.</p>
          </div>
          <div className="inline" style={{ gap: '0.5rem' }}>
            <Link className="btn secondary" href={backHref}>
              Back to tools
            </Link>
            <Link className="btn secondary" href={viewHref}>
              View tool
            </Link>
          </div>
        </header>

        <McpToolForm serverId={serverId} projectId={projectId} initialTool={toolData} />
      </section>
    </AppShell>
  );
}
