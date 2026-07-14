import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const moduleFilter = searchParams.get('module');
    const limit = Number(searchParams.get('limit')) || 80;

    const where = moduleFilter && moduleFilter !== 'ALL' ? { module: moduleFilter } : {};

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('GET /api/activity-logs error:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico de ações' }, { status: 500 });
  }
}
