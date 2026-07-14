import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateCostPerGram, determineFilamentStatus } from '@/lib/calculations';

// GET - Listar todos os rolos
export async function GET() {
  try {
    const rolls = await prisma.filamentRoll.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { productionOrders: true } } },
    });
    return NextResponse.json(rolls);
  } catch (error) {
    console.error('GET /api/filament-rolls error:', error);
    return NextResponse.json({ error: 'Erro ao buscar rolos' }, { status: 500 });
  }
}

// POST - Criar novo rolo
export async function POST(request) {
  try {
    const body = await request.json();
    const { material, color, brand, initialWeightG, costPerRoll } = body;

    if (!material || !color || !brand || !initialWeightG || !costPerRoll) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const costPerGram = calculateCostPerGram(Number(costPerRoll), Number(initialWeightG));

    const roll = await prisma.filamentRoll.create({
      data: {
        material,
        color,
        brand,
        initialWeightG: Number(initialWeightG),
        remainingWeightG: Number(initialWeightG),
        costPerRoll: Number(costPerRoll),
        costPerGram,
        status: 'AVAILABLE',
      },
    });

    return NextResponse.json(roll, { status: 201 });
  } catch (error) {
    console.error('POST /api/filament-rolls error:', error);
    return NextResponse.json({ error: 'Erro ao criar rolo' }, { status: 500 });
  }
}

// PUT - Atualizar rolo
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    // Recalcular custo por grama se necessário
    if (data.costPerRoll && data.initialWeightG) {
      data.costPerGram = calculateCostPerGram(Number(data.costPerRoll), Number(data.initialWeightG));
    }

    // Atualizar status baseado no peso restante
    if (data.remainingWeightG !== undefined) {
      data.status = determineFilamentStatus(Number(data.remainingWeightG));
    }

    const roll = await prisma.filamentRoll.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(roll);
  } catch (error) {
    console.error('PUT /api/filament-rolls error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar rolo' }, { status: 500 });
  }
}

// DELETE - Remover rolo
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    await prisma.filamentRoll.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/filament-rolls error:', error);
    return NextResponse.json({ error: 'Erro ao remover rolo' }, { status: 500 });
  }
}
