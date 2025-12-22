import 'dotenv/config';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createUserAndProject() {
  const email = `dev-check-${randomUUID()}@example.com`;
  const user = await prisma.user.create({ data: { email } });
  const project = await prisma.project.create({ data: { name: 'Dev check project', userId: user.id } });
  return { user, project };
}

async function main() {
  const baseUrl = process.env.MOCK_BASE_URL || 'http://localhost:3000';
  const { user, project } = await createUserAndProject();

  const getRoute = await prisma.mockRoute.create({
    data: {
      userId: user.id,
      projectId: project.id,
      method: 'GET',
      path: `/dev-check-${randomUUID()}`,
      responseBody: JSON.stringify({ ok: true, check: 'get' }),
      responseIsJson: true,
      requireApiKey: true,
    },
  });

  await prisma.mockRoute.update({
    where: { id: getRoute.id },
    data: { responseBody: JSON.stringify({ ok: true, updated: true }) },
  });

  const postRoute = await prisma.mockRoute.create({
    data: {
      userId: user.id,
      projectId: project.id,
      method: 'POST',
      path: `/dev-check-${randomUUID()}`,
      responseBody: '{}',
      responseIsJson: true,
      requestSampleBody: JSON.stringify({ title: 'example' }),
      requestSchema: { type: 'object', properties: { title: { type: 'string' } } },
      requireApiKey: true,
    },
  });

  console.log('GET route responseBody stored:', getRoute.responseBody);
  console.log('POST route requestSampleBody stored:', postRoute.requestSampleBody);

  const targetUrl = `${baseUrl}${getRoute.path}`;
  try {
    const res = await fetch(targetUrl, {
      headers: { 'x-api-key': getRoute.apiKey },
    });
    const json = await res.json();
    console.log('GET route live response status:', res.status);
    console.log('GET route live response body:', json);
  } catch (err) {
    console.warn('Skipped live GET call (server not running?):', err?.message || err);
  }

  const refreshedPost = await prisma.mockRoute.findUnique({ where: { id: postRoute.id } });
  console.log('POST route requestSampleBody from DB:', refreshedPost?.requestSampleBody);
  console.log('POST route requestSchema from DB:', JSON.stringify(refreshedPost?.requestSchema));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
