import 'dotenv/config';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const baseUrl = process.env.MOCK_BASE_URL || 'http://localhost:3000';
  const email = `dataset-demo-${randomUUID()}@example.com`;
  const user = await prisma.user.create({ data: { email } });
  const project = await prisma.project.create({ data: { name: 'Dataset demo project', userId: user.id } });

  const route = await prisma.mockRoute.create({
    data: {
      userId: user.id,
      projectId: project.id,
      method: 'GET',
      path: `/dataset-demo-${randomUUID()}`,
      responseMode: 'DATASET_LOOKUP',
      lookupParamName: 'bookingId',
      responseIsJson: true,
      requireApiKey: false,
    },
  });

  await prisma.routeDataset.create({
    data: {
      routeId: route.id,
      key: 'ABCD',
      valueJson: { bookingId: 'ABCD', status: 'confirmed', from: 'SFO', to: 'LAX' },
      enabled: true,
    },
  });

  const targetUrl = `${baseUrl}${route.path}?bookingId=ABCD`;
  console.log('Created dataset-backed route at:', targetUrl);

  try {
    const res = await fetch(targetUrl);
    const body = await res.json();
    console.log('Live response status:', res.status);
    console.log('Live response body:', body);
  } catch (err) {
    console.warn('Skipped live call (server not running?):', err?.message || err);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
