import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const configs = await prisma.energyConfig.findMany({ orderBy: { effectiveDate: 'desc' } });
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar configurações de energia' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { kwhPrice, utilityName, effectiveDate } = body;
    if (!kwhPrice) return NextResponse.json({ error: 'Preço kWh obrigatório' }, { status: 400 });
    const config = await prisma.energyConfig.create({
      data: {
        kwhPrice: Number(kwhPrice),
        utilityName: utilityName || null,
        effectiveDate: new Date(effectiveDate || Date.now()),
      },
    });
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  }
}
