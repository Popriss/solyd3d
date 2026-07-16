import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateCostPerGram } from '@/lib/calculations';
import { logAction } from '@/lib/activityLogger';

// GET - Listar todos os rolos (com suporte a filtro por ativos)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly');

    const where = activeOnly === 'true' ? { active: true } : {};

    const rolls = await prisma.filamentRoll.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { productionOrders: true } } },
    });
    return NextResponse.json(rolls);
  } catch (error) {
    console.error('GET /api/filament-rolls error:', error);
    return NextResponse.json({ error: 'Erro ao buscar rolos' }, { status: 500 });
  }
}

// POST - Criar novo rolo de filamento (Ativo)
export async function POST(request) {
  try {
    const body = await request.json();
    const { material, color, brand, initialWeightG, costPerRoll, active } = body;

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
        costPerRoll: Number(costPerRoll),
        costPerGram,
        active: active !== undefined ? Boolean(active) : true,
        status: 'AVAILABLE',
      },
    });

    await logAction({ actionType: 'CRIAR', module: 'ESTOQUE', description: `Cadastrou filamento ativo: ${roll.material} ${roll.color} (${roll.brand} — R$ ${Number(roll.costPerGram).toFixed(4)}/g)` });

    return NextResponse.json(roll, { status: 201 });
  } catch (error) {
    console.error('POST /api/filament-rolls error:', error);
    return NextResponse.json({ error: 'Erro ao criar rolo' }, { status: 500 });
  }
}

// PUT - Atualizar filamento (Toggle Ativo/Inativo e Atualização Rápida de Preço)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    // Recalcular custo por grama se o preço ou peso inicial mudaram
    if (data.costPerRoll !== undefined || data.initialWeightG !== undefined) {
      const current = await prisma.filamentRoll.findUnique({ where: { id: Number(id) } });
      if (!current) return NextResponse.json({ error: 'Filamento não encontrado' }, { status: 404 });

      const newCost = data.costPerRoll !== undefined ? Number(data.costPerRoll) : Number(current.costPerRoll);
      const newWeight = data.initialWeightG !== undefined ? Number(data.initialWeightG) : Number(current.initialWeightG);

      data.costPerRoll = newCost;
      data.initialWeightG = newWeight;
      data.costPerGram = calculateCostPerGram(newCost, newWeight);
      // Sempre que atualizar com novo preço/compra, garante que o filamento volta para Ativo
      if (data.isPriceUpdate) {
        data.active = true;
        delete data.isPriceUpdate;
      }
    }

    if (data.active !== undefined) {
      data.active = Boolean(data.active);
    }

    const roll = await prisma.filamentRoll.update({
      where: { id: Number(id) },
      data,
    });

    const statusText = roll.active ? 'Ativo' : 'Inativo';
    await logAction({ actionType: 'ATUALIZAR', module: 'ESTOQUE', description: `Atualizou filamento #${roll.id} (${roll.material} ${roll.color}) — Status: ${statusText}` });

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
    await logAction({ actionType: 'EXCLUIR', module: 'ESTOQUE', description: `Removeu rolo de filamento ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/filament-rolls error:', error);
    return NextResponse.json({ error: 'Erro ao remover rolo' }, { status: 500 });
  }
}
