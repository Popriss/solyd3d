import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// GET - Listar chapas de um produto ou todas as chapas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    const where = productId ? { productId: Number(productId) } : {};
    const plates = await prisma.productPlate.findMany({
      where,
      orderBy: { id: 'asc' },
      include: { product: { select: { id: true, name: true } } },
    });

    return NextResponse.json(plates);
  } catch (error) {
    console.error('GET /api/product-plates error:', error);
    return NextResponse.json({ error: 'Erro ao buscar chapas' }, { status: 500 });
  }
}

// POST - Adicionar chapa a um produto existente
export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, name, estimatedWeightG, estimatedPrintMinutes, materialColorNeeded, yieldPerCycle } = body;

    if (!productId || !name || estimatedWeightG === undefined || estimatedPrintMinutes === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando (productId, name, peso, tempo)' }, { status: 400 });
    }

    const plate = await prisma.productPlate.create({
      data: {
        productId: Number(productId),
        name,
        estimatedWeightG: Number(estimatedWeightG || 0),
        estimatedPrintMinutes: Number(estimatedPrintMinutes || 0),
        materialColorNeeded: materialColorNeeded || null,
        yieldPerCycle: Math.max(1, Number(yieldPerCycle || 1)),
      },
    });

    await logAction({
      actionType: 'CRIAR',
      module: 'PRODUTOS',
      description: `Adicionou chapa BOM "${plate.name}" ao produto #${productId}`,
    });

    return NextResponse.json(plate, { status: 201 });
  } catch (error) {
    console.error('POST /api/product-plates error:', error);
    return NextResponse.json({ error: 'Erro ao criar chapa' }, { status: 500 });
  }
}

// PUT - Atualizar chapa existente
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, estimatedWeightG, estimatedPrintMinutes, materialColorNeeded, yieldPerCycle } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da chapa é obrigatório' }, { status: 400 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (estimatedWeightG !== undefined) updateData.estimatedWeightG = Number(estimatedWeightG);
    if (estimatedPrintMinutes !== undefined) updateData.estimatedPrintMinutes = Number(estimatedPrintMinutes);
    if (materialColorNeeded !== undefined) updateData.materialColorNeeded = materialColorNeeded;
    if (yieldPerCycle !== undefined) updateData.yieldPerCycle = Math.max(1, Number(yieldPerCycle || 1));

    const plate = await prisma.productPlate.update({
      where: { id: Number(id) },
      data: updateData,
    });

    await logAction({
      actionType: 'ATUALIZAR',
      module: 'PRODUTOS',
      description: `Atualizou chapa BOM #${plate.id} "${plate.name}"`,
    });

    return NextResponse.json(plate);
  } catch (error) {
    console.error('PUT /api/product-plates error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar chapa' }, { status: 500 });
  }
}

// DELETE - Excluir chapa do BOM
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da chapa é obrigatório' }, { status: 400 });
    }

    await prisma.productPlate.delete({ where: { id: Number(id) } });

    await logAction({
      actionType: 'EXCLUIR',
      module: 'PRODUTOS',
      description: `Removeu chapa BOM ID #${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/product-plates error:', error);
    return NextResponse.json({ error: 'Erro ao remover chapa' }, { status: 500 });
  }
}
