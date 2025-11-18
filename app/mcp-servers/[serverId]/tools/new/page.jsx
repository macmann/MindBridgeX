import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppShell from '../../../../../components/dashboard/AppShell.jsx';
import CreateToolsFromRoutes from '../../../../../components/mcp/CreateToolsFromRoutes.jsx';
import OpenApiToolImporter from '../../../../../components/mcp/OpenApiToolImporter.jsx';
import { getDashboardContext } from '../../../../../lib/dashboard-context.js';
import prisma from '../../../../../lib/prisma.js';

function withProjectHref(base, projectId) {
  if (!projectId) return base;
  const url = new URL(base, 'https://placeholder.local');
  url.searchParams.set('projectId', projectId);
  return `${url.pathname}${url.search ? url.search : ''}`;
}

export default async function NewMcpToolsPage({ params, searchParams }) {
  const { session, userId, projects, activeProjectId } = await getDashboardContext(searchParams);
  const serverId = Number(params?.serverId);
  if (!serverId) {
    notFound();
  }

  const server = await prisma.mcpServer.findFirst({ where: { id: serverId, userId } });
  if (!server) {
    notFound();
  }

  const projectId = server.projectId || activeProjectId;
  const routes = await prisma.mockRoute.findMany({
    where: { userId, projectId: server.projectId },
    orderBy: { updatedAt: 'desc' },
  });
  const existingToolNames = await prisma.mcpTool.findMany({
    where: { serverId: server.id },
    select: { name: true },
  });
  const toolNames = existingToolNames.map((tool) => tool.name);
  const listHref = withProjectHref(`/mcp-servers/${server.id}/tools`, projectId);

  return (
    <AppShell session={session} projects={projects} activeProjectId={projectId}>
      <section className="section-card">
        <header>
          <div>
            <h2>Add tools for {server.name}</h2>
            <p>
              Choose from your internal routes or import operations from an OpenAPI document. Base URL:{' '}
              <code>{server.baseUrl || 'not set yet'}</code>
            </p>
          </div>
          <Link className="btn secondary" href={listHref}>
            Back to tools
          </Link>
        </header>
        <div className="stack" style={{ gap: '2rem' }}>
          <CreateToolsFromRoutes serverId={server.id} projectId={projectId} routes={routes} />
          <OpenApiToolImporter
            serverId={server.id}
            projectId={projectId}
            defaultBaseUrl={server.baseUrl || ''}
            existingToolNames={toolNames}
          />
        </div>
      </section>
    </AppShell>
  );
}
