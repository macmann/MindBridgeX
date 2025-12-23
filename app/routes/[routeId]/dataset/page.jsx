import Link from 'next/link';
import { notFound } from 'next/navigation';

import AppShell from '../../../../components/dashboard/AppShell.jsx';
import RouteDatasetManager from '../../../../components/routes/RouteDatasetManager.jsx';
import { getDashboardContext } from '../../../../lib/dashboard-context.js';
import prisma from '../../../../lib/prisma.js';

function withProjectHref(base, projectId) {
  if (!projectId) return base;
  const url = new URL(base, 'https://placeholder.local');
  url.searchParams.set('projectId', projectId);
  return `${url.pathname}${url.search ? url.search : ''}`;
}

export default async function RouteDatasetPage({ params, searchParams }) {
  const routeId = Number(params?.routeId);
  if (!routeId) {
    notFound();
  }

  const { session, userId, projects, activeProjectId } = await getDashboardContext(searchParams);
  const route = await prisma.mockRoute.findFirst({
    where: { id: routeId, userId },
  });

  if (!route) {
    notFound();
  }

  const projectId = route.projectId || activeProjectId;
  const backHref = withProjectHref(`/routes/${route.id}`, projectId);

  const datasetRecords = await prisma.routeDataset.findMany({
    where: { routeId: route.id },
    orderBy: { updatedAt: 'desc' },
  });

  const initialRecords = datasetRecords.map((record) => ({
    ...record,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
  }));

  return (
    <AppShell session={session} projects={projects} activeProjectId={projectId}>
      <section className="section-card">
        <header>
          <div>
            <h2>Dataset</h2>
            <p>Manage lookup keys and JSON payloads returned by this route.</p>
          </div>
          <Link className="btn secondary" href={backHref}>
            Back to route
          </Link>
        </header>

        <RouteDatasetManager
          routeId={route.id}
          routeMethod={route.method}
          routePath={route.path}
          lookupParamName={route.lookupParamName}
          responseFields={route.responseFieldsJson || []}
          initialRecords={initialRecords}
        />
      </section>
    </AppShell>
  );
}
