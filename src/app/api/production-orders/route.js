import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  calculateMaterialCost,
  calculateEnergyCost,
  calculateTotalCost
} from '@/lib/calculations';
import { logAction } from '@/lib/activityLogger';

// GET - Listar ordens de produção
export async function GET() {
  try {
    const orders = await prisma.productionOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        filamentRoll: true,
        machine: { select: { id: true, name: true, powerWatts: true } },
      },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('GET /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao buscar ordens' }, { status: 500 });
  }
}

// POST - Criar ordem de produção (e Gatilho Reverso de Venda se for Avulsa ou Encomenda)
export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, filamentRollId, machineId, notes, quantity, destinationType, destinationName, saleId, saleItemId } = body;

    if (!productId || !filamentRollId || !machineId) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const qty = Number(quantity) || 1;
    const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
    const roll = await prisma.filamentRoll.findUnique({ where: { id: Number(filamentRollId) } });

    let linkedSaleId = saleId ? Number(saleId) : null;
    let linkedSaleItemId = saleItemId ? Number(saleItemId) : null;

    // GATILHO REVERSO: Se for Venda Avulsa ou Encomenda e ainda não tiver Venda atrelada, criar uma Venda em /vendas automaticamente!
    if (!linkedSaleId && (destinationType === 'DIRECT_SALE' || destinationType === 'ORDER') && destinationName && product) {
      const unitPrice = Number(product.salePrice || 25.0);
      const totalPrice = unitPrice * qty;
      const estimatedMinutes = (Number(product.estimatedPrintMinutes) || 60) * qty;
      const costPerGram = roll ? Number(roll.costPerRoll || 150) / Number(roll.initialWeightG || 1000) : 0.15;
      const unitCost = Number(product.estimatedWeightG || 50) * costPerGram + 3.0;

      const reverseSale = await prisma.sale.create({
        data: {
          customerName: destinationName,
          status: 'ACTIVE',
          totalAmount: totalPrice,
          estimatedPrintMinutes: estimatedMinutes,
          notes: `[Gatilho Reverso OP] Criada via Ordem de Produção manual — ${qty}x ${product.name}`,
          items: {
            create: {
              productId: product.id,
              quantity: qty,
              unitPrice,
              unitCost,
              totalPrice,
              estimatedMinutes,
            },
          },
        },
        include: { items: true },
      });

      linkedSaleId = reverseSale.id;
      if (reverseSale.items[0]) {
        linkedSaleItemId = reverseSale.items[0].id;
      }
    }

    const order = await prisma.productionOrder.create({
      data: {
        productId: Number(productId),
        filamentRollId: Number(filamentRollId),
        machineId: Number(machineId),
        status: 'QUEUED',
        quantity: qty,
        destinationType: destinationType || null,
        destinationName: destinationName || null,
        saleId: linkedSaleId,
        saleItemId: linkedSaleItemId,
        notes: notes || null,
      },
      include: {
        product: true,
        filamentRoll: true,
        machine: true,
        sale: true,
      },
    });

    await logAction({ actionType: 'CRIAR', module: 'PRODUCAO', description: `Criou ordem de produção #${order.id} (${qty}x ${order.product?.name || 'Peça 3D'})${destinationName ? ' para ' + destinationName : ''}` });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('POST /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao criar ordem' }, { status: 500 });
  }
}

// PUT - Atualizar status da ordem (Custeio Qualitativo sem baixa no estoque de filamento)
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

      // Ao finalizar ou falhar: calcular custos puramente com base no custo por grama do filamento ativo
      // REGRA DE OURO: Nenhuma quantidade em gramas é subtraída do banco de dados (baixa abolida)
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

        const costPerGram = existingOrder.filamentRoll ? Number(existingOrder.filamentRoll.costPerGram) : 0.12;
        const matCost = calculateMaterialCost(weightUsed, costPerGram);
        const enCost = calculateEnergyCost(Number(existingOrder.machine.powerWatts), printMins, kwhPrice);

        updateData.actualWeightG = weightUsed;
        updateData.actualPrintMinutes = printMins;
        updateData.materialCost = matCost;
        updateData.energyCost = enCost;
        updateData.totalCost = calculateTotalCost(matCost, enCost);

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

    await logAction({ actionType: status === 'COMPLETED' ? 'CONCLUIR' : 'ATUALIZAR', module: 'PRODUCAO', description: `Atualizou ordem de produção #${updatedOrder.id} (${updatedOrder.product?.name || 'Peça'}) para status ${updatedOrder.status}` });

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
    await logAction({ actionType: 'EXCLUIR', module: 'PRODUCAO', description: `Removeu ordem de produção ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao remover ordem' }, { status: 500 });
  }
}
