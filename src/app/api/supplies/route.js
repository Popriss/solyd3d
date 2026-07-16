import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// GET - Listar todos os insumos e hardware
export async function GET() {
  try {
    const supplies = await prisma.supplyItem.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(supplies);
  } catch (error) {
    console.error('GET /api/supplies error:', error);
    return NextResponse.json({ error: 'Erro ao buscar insumos' }, { status: 500 });
  }
}

// POST - Criar novo insumo / hardware
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, category, unitCost, stockQuantity, active } = body;

    if (!name || unitCost === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const supply = await prisma.supplyItem.create({
      data: {
        name,
        category: category || 'Hardware',
        unitCost: Number(unitCost),
        stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : 0,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    await logAction({ actionType: 'CRIAR', module: 'ESTOQUE', description: `Cadastrou insumo/hardware: ${supply.name} (R$ ${supply.unitCost}/un)` });

    return NextResponse.json(supply, { status: 201 });
  } catch (error) {
    console.error('POST /api/supplies error:', error);
    return NextResponse.json({ error: 'Erro ao criar insumo' }, { status: 500 });
  }
}

// PUT - Atualizar insumo / hardware
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    if (data.unitCost !== undefined) data.unitCost = Number(data.unitCost);
    if (data.stockQuantity !== undefined) data.stockQuantity = Number(data.stockQuantity);
    if (data.active !== undefined) data.active = Boolean(data.active);

    const supply = await prisma.supplyItem.update({
      where: { id: Number(id) },
      data,
    });

    await logAction({ actionType: 'ATUALIZAR', module: 'ESTOQUE', description: `Atualizou insumo/hardware #${supply.id} (${supply.name})` });

    return NextResponse.json(supply);
  } catch (error) {
    console.error('PUT /api/supplies error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar insumo' }, { status: 500 });
  }
}

// DELETE - Remover insumo / hardware
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    await prisma.supplyItem.delete({ where: { id: Number(id) } });
    await logAction({ actionType: 'EXCLUIR', module: 'ESTOQUE', description: `Removeu insumo/hardware ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/supplies error:', error);
    return NextResponse.json({ error: 'Erro ao remover insumo' }, { status: 500 });
  }
}
