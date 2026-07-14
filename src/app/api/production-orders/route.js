import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  calculateMaterialCost,
  calculateEnergyCost,
  calculateTotalCost,
  determineFilamentStatus
} from '@/lib/calculations';

// GET - Listar ordens de produção
export async function GET() {
  try {
    const orders = await prisma.productionOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, estimatedWeightG: true, estimatedPrintMinutes: true } },
        filamentRoll: { select: { id: true, material: true, color: true, brand: true, costPerGram: true, remainingWeightG: true } },
        machine: { select: { id: true, name: true, powerWatts: true } },
      },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('GET /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao buscar ordens' }, { status: 500 });
  }
}

// POST - Criar ordem de produção
export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, filamentRollId, machineId, notes } = body;

    if (!productId || !filamentRollId || !machineId) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const order = await prisma.productionOrder.create({
      data: {
        productId: Number(productId),
        filamentRollId: Number(filamentRollId),
        machineId: Number(machineId),
        status: 'QUEUED',
        notes: notes || null,
      },
      include: {
        product: true,
        filamentRoll: true,
        machine: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('POST /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao criar ordem' }, { status: 500 });
  }
}

// PUT - Atualizar status da ordem (inclui baixa de estoque)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, status, actualWeightG, actualPrintMinutes, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    // Buscar a ordem com seus relacionamentos
    const existingOrder = await prisma.productionOrder.findUnique({
      where: { id: Number(id) },
      include: { filamentRoll: true, machine: true, product: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 });
    }

    const updateData = {};

    // Atualizar status
    if (status) {
      updateData.status = status;

      if (status === 'PRINTING') {
        updateData.startedAt = new Date();
      }

      // Ao finalizar ou falhar: calcular custos e deduzir estoque
      if (status === 'COMPLETED' || status === 'FAILED') {
        updateData.finishedAt = new Date();
        updateData.isFailure = status === 'FAILED';

        const weightUsed = Number(actualWeightG || existingOrder.product.estimatedWeightG);
        const printMins = Number(actualPrintMinutes || existingOrder.product.estimatedPrintMinutes);

        // Buscar config de energia mais recente
        const energyConfig = await prisma.energyConfig.findFirst({
          orderBy: { effectiveDate: 'desc' },
        });
        const kwhPrice = energyConfig ? Number(energyConfig.kwhPrice) : 0.85;

        const matCost = calculateMaterialCost(weightUsed, Number(existingOrder.filamentRoll.costPerGram));
        const enCost = calculateEnergyCost(Number(existingOrder.machine.powerWatts), printMins, kwhPrice);

        updateData.actualWeightG = weightUsed;
        updateData.actualPrintMinutes = printMins;
        updateData.materialCost = matCost;
        updateData.energyCost = enCost;
        updateData.totalCost = calculateTotalCost(matCost, enCost);

        // BAIXA DE ESTOQUE — deduz do rolo (inclusive em falhas)
        const newRemaining = Math.max(0, Number(existingOrder.filamentRoll.remainingWeightG) - weightUsed);
        await prisma.filamentRoll.update({
          where: { id: existingOrder.filamentRollId },
          data: {
            remainingWeightG: newRemaining,
            status: determineFilamentStatus(newRemaining),
          },
        });

        // Se finalizou com sucesso (COMPLETED), entra no Estoque Pronto do produto
        if (status === 'COMPLETED' && existingOrder.status !== 'COMPLETED') {
          await prisma.product.update({
            where: { id: existingOrder.productId },
            data: { stockReady: { increment: 1 } },
          });
        }
      }
    }

    if (notes !== undefined) updateData.notes = notes;
    if (actualWeightG && !updateData.actualWeightG) updateData.actualWeightG = Number(actualWeightG);
    if (actualPrintMinutes && !updateData.actualPrintMinutes) updateData.actualPrintMinutes = Number(actualPrintMinutes);

    const updatedOrder = await prisma.productionOrder.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        product: true,
        filamentRoll: true,
        machine: true,
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('PUT /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar ordem' }, { status: 500 });
  }
}

// DELETE - Remover ordem
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    await prisma.productionOrder.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao remover ordem' }, { status: 500 });
  }
}
