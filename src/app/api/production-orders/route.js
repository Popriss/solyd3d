import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  calculateMaterialCost,
  calculateEnergyCost,
  calculateTotalCost,
  determineFilamentStatus,
} from '@/lib/calculations';
import { logAction } from '@/lib/activityLogger';

// GET - Listar ordens de produção com as tarefas de chapa (PrintTasks)
export async function GET() {
  try {
    const orders = await prisma.productionOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        product: { include: { plates: true } },
        filamentRoll: true,
        machine: { select: { id: true, name: true, powerWatts: true } },
        sale: { select: { id: true, customerName: true, status: true } },
        printTasks: {
          orderBy: { id: 'asc' },
          include: {
            productPlate: true,
            filamentRoll: true,
            machine: { select: { id: true, name: true, powerWatts: true } },
          },
        },
      },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('GET /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao buscar ordens' }, { status: 500 });
  }
}

// POST - Criar ordem de produção (com transação gerando PrintTasks por chapa no BOM)
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      productId,
      filamentRollId,
      machineId,
      notes,
      quantity,
      destinationType,
      destinationName,
      saleId,
      saleItemId,
      plateOverrides, // Opcional: Array de [{ productPlateId: 1, targetCycles: 15 }]
    } = body;

    if (!productId) {
      return NextResponse.json({ error: 'ID do produto é obrigatório' }, { status: 400 });
    }

    const qty = Number(quantity) || 1;

    // Executa transação garantindo atomicidade na criação da OP Pai + Chapas Filhas (PrintTasks)
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: Number(productId) },
        include: { plates: true },
      });

      if (!product) {
        throw new Error('Produto não encontrado');
      }

      const roll = filamentRollId ? await tx.filamentRoll.findUnique({ where: { id: Number(filamentRollId) } }) : null;

      let linkedSaleId = saleId ? Number(saleId) : null;
      let linkedSaleItemId = saleItemId ? Number(saleItemId) : null;

      // GATILHO REVERSO: Se for Venda Avulsa ou Encomenda e não tiver Venda vinculada, cria em /vendas!
      if (!linkedSaleId && (destinationType === 'DIRECT_SALE' || destinationType === 'ORDER') && destinationName) {
        const unitPrice = Number(product.salePrice || 25.0);
        const totalPrice = unitPrice * qty;
        
        const totalWeight = product.plates.length > 0 
          ? product.plates.reduce((acc, p) => acc + Number(p.estimatedWeightG), 0)
          : Number(product.estimatedWeightG || 50);
        const totalMinutes = product.plates.length > 0 
          ? product.plates.reduce((acc, p) => acc + Number(p.estimatedPrintMinutes), 0) * qty
          : Number(product.estimatedPrintMinutes || 60) * qty;

        const costPerGram = roll ? Number(roll.costPerRoll || 150) / Number(roll.initialWeightG || 1000) : 0.15;
        const unitCost = totalWeight * costPerGram + 3.0;

        const reverseSale = await tx.sale.create({
          data: {
            customerName: destinationName,
            status: 'ACTIVE',
            totalAmount: totalPrice,
            estimatedPrintMinutes: totalMinutes,
            notes: `[Gatilho Reverso OP BOM] Criada via Ordem de Produção manual — ${qty}x ${product.name}`,
            items: {
              create: {
                productId: product.id,
                quantity: qty,
                unitPrice,
                unitCost,
                totalPrice,
                estimatedMinutes: totalMinutes,
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

      // 1. Cria a Ordem de Produção Pai (Lote)
      const order = await tx.productionOrder.create({
        data: {
          productId: Number(productId),
          filamentRollId: filamentRollId ? Number(filamentRollId) : null,
          machineId: machineId ? Number(machineId) : null,
          status: 'QUEUED',
          targetQuantity: qty,
          quantity: qty, // Retrocompatibilidade
          destinationType: destinationType || null,
          destinationName: destinationName || null,
          saleId: linkedSaleId,
          saleItemId: linkedSaleItemId,
          notes: notes || null,
        },
      });

      // 2. Criação Iterativa das PrintTasks (Chapas no Kanban com multiplicador de ciclo)
      let platesToProcess = product.plates;

      // Fallback para Produto Legado (sem chapa cadastrada no BOM ainda)
      if (platesToProcess.length === 0) {
        const fallbackPlate = await tx.productPlate.create({
          data: {
            productId: product.id,
            name: `${product.name} (Chapa Principal)`,
            estimatedWeightG: Number(product.estimatedWeightG || 50),
            estimatedPrintMinutes: Number(product.estimatedPrintMinutes || 60),
            materialColorNeeded: product.recommendedColor || roll?.color || 'Padrão',
            yieldPerCycle: 1,
          },
        });
        platesToProcess = [fallbackPlate];
      }

      for (const plate of platesToProcess) {
        const yieldQty = Math.max(1, Number(plate.yieldPerCycle || 1));
        const defaultCycles = Math.ceil(qty / yieldQty);

        // Verifica se houve override personalizado de ciclos para esta placa
        const override = Array.isArray(plateOverrides)
          ? plateOverrides.find((o) => Number(o.productPlateId) === plate.id)
          : null;
        const targetCycles = override && override.targetCycles !== undefined
          ? Math.max(1, Number(override.targetCycles))
          : defaultCycles;

        await tx.printTask.create({
          data: {
            productionOrderId: order.id,
            productPlateId: plate.id,
            filamentRollId: filamentRollId ? Number(filamentRollId) : null,
            machineId: machineId ? Number(machineId) : null,
            status: 'QUEUED',
            targetCycles,
            completedCycles: 0,
          },
        });
      }

      return tx.productionOrder.findUnique({
        where: { id: order.id },
        include: {
          product: true,
          printTasks: { include: { productPlate: true, filamentRoll: true, machine: true } },
          filamentRoll: true,
          machine: true,
          sale: true,
        },
      });
    });

    await logAction({
      actionType: 'CRIAR',
      module: 'PRODUCAO',
      description: `Criou Lote BOM #${result.id} (${qty}x ${result.product.name}) com ${result.printTasks.length} tarefas de chapa.`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/production-orders error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao criar ordem de produção' }, { status: 500 });
  }
}

// PUT - Atualizar status da ordem (com lógica condicional de Estoque Granular)
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

    // Buscar configuração do modo de estoque granular
    const granularConfig = await prisma.systemConfig.findUnique({
      where: { key: 'modo_estoque_granular' },
    });
    const isGranular = granularConfig?.value === 'true';

    const updateData = {};

    // Atualizar status
    if (status) {
      updateData.status = status;

      if (status === 'PRINTING') {
        updateData.startedAt = new Date();
      }

      // Ao finalizar ou falhar: calcular custos e opcionalmente subtrair estoque
      if (status === 'COMPLETED' || status === 'FAILED') {
        updateData.finishedAt = new Date();
        updateData.isFailure = status === 'FAILED';

        const weightUsed = Number(actualWeightG || existingOrder.product.estimatedWeightG);
        const printMins = Number(actualPrintMinutes || existingOrder.product.estimatedPrintMinutes);
        const qty = existingOrder.quantity || 1;

        // Buscar config de energia mais recente
        const energyConfig = await prisma.energyConfig.findFirst({
          orderBy: { effectiveDate: 'desc' },
        });
        const kwhPrice = energyConfig ? Number(energyConfig.kwhPrice) : 0.85;

        const costPerGram = existingOrder.filamentRoll ? Number(existingOrder.filamentRoll.costPerGram) : 0.12;
        const matCost = calculateMaterialCost(weightUsed * qty, costPerGram);
        const enCost = calculateEnergyCost(Number(existingOrder.machine.powerWatts), printMins * qty, kwhPrice);

        updateData.actualWeightG = weightUsed;
        updateData.actualPrintMinutes = printMins;
        updateData.materialCost = matCost;
        updateData.energyCost = enCost;
        updateData.totalCost = calculateTotalCost(matCost, enCost);

        // ============================================================
        // CHAVE DE ESTOQUE GRANULAR — Lógica condicional
        // ============================================================
        if (isGranular && existingOrder.filamentRoll) {
          // Modo Granular LIGADO: subtrair peso do rolo de filamento
          const totalWeightToSubtract = weightUsed * qty;
          const currentRemaining = Number(
            existingOrder.filamentRoll.remainingWeightG
            ?? existingOrder.filamentRoll.initialWeightG
          );
          const newRemaining = Math.max(0, currentRemaining - totalWeightToSubtract);

          await prisma.filamentRoll.update({
            where: { id: existingOrder.filamentRollId },
            data: {
              remainingWeightG: newRemaining,
              status: determineFilamentStatus(newRemaining),
              // Se zerou, desativar automaticamente
              active: newRemaining > 0,
            },
          });
        }
        // Se !isGranular: Modo Simplificado — NÃO toca no estoque (comportamento original)

        // Se finalizou com sucesso (COMPLETED), entra no Estoque Pronto do produto
        if (status === 'COMPLETED' && existingOrder.status !== 'COMPLETED') {
          await prisma.product.update({
            where: { id: existingOrder.productId },
            data: { stockReady: { increment: existingOrder.quantity || 1 } },
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

    const statusLabels = {
      QUEUED: 'Na Fila', SLICED: 'Fatiado', PRINTING: 'Imprimindo',
      POST_PROCESSING: 'Pós-Processamento', COMPLETED: 'Concluído', FAILED: 'Falha/Scrap',
    };
    const granularNote = (status === 'COMPLETED' || status === 'FAILED') && isGranular
      ? ' [Estoque Granular: baixa de gramas aplicada]'
      : '';

    await logAction({
      actionType: status === 'COMPLETED' ? 'CONCLUIR' : 'ATUALIZAR',
      module: 'PRODUCAO',
      description: `Moveu OP #${updatedOrder.id} (${updatedOrder.product?.name || 'Peça'}) → ${statusLabels[updatedOrder.status] || updatedOrder.status}${granularNote}`,
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
    await logAction({ actionType: 'EXCLUIR', module: 'PRODUCAO', description: `Removeu ordem de produção ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/production-orders error:', error);
    return NextResponse.json({ error: 'Erro ao remover ordem' }, { status: 500 });
  }
}
