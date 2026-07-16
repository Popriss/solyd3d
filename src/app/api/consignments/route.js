import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// GET - Listar todas as consignações/remessas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const salesPointId = searchParams.get('salesPointId');

    const where = {};
    if (salesPointId) {
      where.salesPointId = Number(salesPointId);
    }

    const consignments = await prisma.consignment.findMany({
      where,
      orderBy: { deliveryDate: 'desc' },
      include: {
        salesPoint: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(consignments);
  } catch (error) {
    console.error('GET /api/consignments error:', error);
    return NextResponse.json({ error: 'Erro ao buscar remessas' }, { status: 500 });
  }
}

// POST - Criar nova remessa de consignação (envio para banca)
export async function POST(request) {
  try {
    const body = await request.json();
    const { salesPointId, deliveryDate, notes, items } = body;

    if (!salesPointId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Ponto de venda e itens são obrigatórios' }, { status: 400 });
    }

    // Calcular o total esperado (se todos os itens venderem)
    let totalExpected = 0;
    const itemsData = [];

    for (const item of items) {
      const qty = Number(item.quantitySent || 0);
      const price = Number(item.unitPrice || 0);
      if (qty > 0) {
        totalExpected += qty * price;
        itemsData.push({
          productId: Number(item.productId),
          quantitySent: qty,
          unitPrice: price,
          status: 'CONSIGNED',
        });
      }
    }

    if (itemsData.length === 0) {
      return NextResponse.json({ error: 'Adicione pelo menos um item com quantidade > 0' }, { status: 400 });
    }

    // Criar a consignação e deduzir o estoque pronto dos produtos
    const consignment = await prisma.$transaction(async (tx) => {
      const created = await tx.consignment.create({
        data: {
          salesPointId: Number(salesPointId),
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          status: 'PENDING',
          notes: notes || null,
          totalExpected,
          items: {
            create: itemsData,
          },
        },
        include: {
          salesPoint: true,
          items: { include: { product: true } },
        },
      });

      // Deduzir peças enviadas do Estoque Pronto (stockReady) de cada produto
      for (const item of itemsData) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockReady: {
              decrement: item.quantitySent,
            },
          },
        });
      }

      return created;
    });

    await logAction({ actionType: 'CRIAR', module: 'VENDAS', description: `Criou remessa de consignação #${consignment.id} com ${itemsData.length} itens` });

    return NextResponse.json(consignment, { status: 201 });
  } catch (error) {
    console.error('POST /api/consignments error:', error);
    return NextResponse.json({ error: 'Erro ao criar remessa' }, { status: 500 });
  }
}

// PUT - Realizar Acerto da Consignação, Reestoque (Encher Estoque) ou alterar preços de itens
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, action, itemId, unitPrice, costPrice, settlementDate, notes, items } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da remessa obrigatório' }, { status: 400 });
    }

    const existing = await prisma.consignment.findUnique({
      where: { id: Number(id) },
      include: { salesPoint: true, items: { include: { product: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Remessa não encontrada' }, { status: 404 });
    }

    // 1. AÇÃO: ALTERAR PREÇO OU CUSTO DO ITEM LIVREMENTE NO PARCEIRO
    if (action === 'UPDATE_ITEM_PRICE' && itemId) {
      const updatedItem = await prisma.consignmentItem.update({
        where: { id: Number(itemId) },
        data: {
          unitPrice: unitPrice !== undefined ? Number(unitPrice) : undefined,
          costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
        },
      });
      return NextResponse.json(updatedItem);
    }

    // 2. AÇÃO: ENCHER ESTOQUE (RESTOCK -> Gerar OPs automáticas para o que falta na banca)
    if (action === 'RESTOCK') {
      const activeRoll = await prisma.filamentRoll.findFirst({ where: { active: true } }) || await prisma.filamentRoll.findFirst();
      const activeMachine = await prisma.machine.findFirst({ where: { status: 'ACTIVE' } }) || await prisma.machine.findFirst();

      if (!activeRoll || !activeMachine) {
        return NextResponse.json({ error: 'Para gerar OPs de reestoque, cadastre pelo menos 1 Filamento e 1 Máquina ativos.' }, { status: 400 });
      }

      const generatedOps = [];
      for (const item of existing.items) {
        const target = item.targetQuota ? Number(item.targetQuota) : Number(item.quantitySent);
        const currentStockInBanca = Number(item.quantitySent) - Number(item.quantitySold) - Number(item.quantityReturned) - Number(item.quantityLost);
        const missingQty = target - currentStockInBanca;

        if (missingQty > 0) {
          const op = await prisma.productionOrder.create({
            data: {
              productId: item.productId,
              filamentRollId: activeRoll.id,
              machineId: activeMachine.id,
              status: 'QUEUED',
              quantity: missingQty,
              destinationType: 'SALES_POINT',
              destinationName: existing.salesPoint.name,
              notes: `[Encher Estoque - Remessa #${existing.id}] ${missingQty}x ${item.product?.name || 'Peça'} para ${existing.salesPoint.name}`,
            },
          });
          generatedOps.push(op);

          // Atualizar o item da consignação para prever o reestoque que chegará (ou apenas deixamos a OP para quando for enviada uma nova remessa)
        }
      }

      await logAction({
        userName: 'Sistema',
        userEmail: 'admin@solyd3d.com',
        actionType: 'CRIAR',
        module: 'PRODUCAO',
        description: `Disparou Encher Estoque para a remessa #${existing.id} (${existing.salesPoint.name}): ${generatedOps.length} OPs geradas na fila.`,
      });

      return NextResponse.json({ success: true, generatedOps });
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Itens do acerto são obrigatórios' }, { status: 400 });
    }

    const commissionPct = Number(existing.salesPoint.commissionPct || 0);

    const updated = await prisma.$transaction(async (tx) => {
      let totalSettled = 0;
      let totalCostOfSoldAndLost = 0;
      let allCompleted = true;

      for (const itemUpdate of items) {
        const existingItem = existing.items.find((i) => i.id === Number(itemUpdate.id));
        if (!existingItem) continue;

        const qtySold = Number(itemUpdate.quantitySold || 0);
        const qtyReturned = Number(itemUpdate.quantityReturned || 0);
        const qtyLost = Number(itemUpdate.quantityLost || 0);
        const qtySent = existingItem.quantitySent;

        const totalSoldValue = qtySold * Number(existingItem.unitPrice);
        totalSettled += totalSoldValue;

        // Se sobraram itens não contabilizados, o status global não estará 100% resolvido
        if (qtySold + qtyReturned + qtyLost < qtySent) {
          allCompleted = false;
        }

        // Buscar a última ordem de produção finalizada deste produto para estimar o custo unitário (g × custo material + energia)
        const lastProduction = await tx.productionOrder.findFirst({
          where: { productId: existingItem.productId, status: 'COMPLETED' },
          orderBy: { finishedAt: 'desc' },
        });

        const estimatedCostUnit = lastProduction && Number(lastProduction.totalCost) > 0
          ? Number(lastProduction.totalCost)
          : 5.0; // valor fallback de segurança de custo

        const costPriceTotal = (qtySold + qtyLost) * estimatedCostUnit;
        totalCostOfSoldAndLost += costPriceTotal;

        // Atualizar item
        await tx.consignmentItem.update({
          where: { id: existingItem.id },
          data: {
            quantitySold: qtySold,
            quantityReturned: qtyReturned,
            quantityLost: qtyLost,
            costPrice: estimatedCostUnit,
            totalSoldValue,
            status: qtySold + qtyReturned + qtyLost >= qtySent ? 'SETTLED' : 'CONSIGNED',
          },
        });

        // Se houve devoluções agora (ou diferença em relação ao anterior), precisamos devolver as peças ao estoque pronto
        const previousReturned = existingItem.quantityReturned;
        const returnedDiff = qtyReturned - previousReturned;
        if (returnedDiff !== 0) {
          await tx.product.update({
            where: { id: existingItem.productId },
            data: {
              stockReady: {
                increment: returnedDiff,
              },
            },
          });
        }
      }

      const totalCommission = totalSettled * (commissionPct / 100);
      const netRevenue = totalSettled - totalCommission;
      const totalProfit = netRevenue - totalCostOfSoldAndLost;

      const newStatus = allCompleted ? 'SETTLED' : (totalSettled > 0 ? 'PARTIAL' : 'PENDING');

      return await tx.consignment.update({
        where: { id: Number(id) },
        data: {
          settlementDate: settlementDate ? new Date(settlementDate) : new Date(),
          notes: notes !== undefined ? notes : existing.notes,
          status: newStatus,
          totalSettled,
          totalCommission,
          totalProfit,
        },
        include: {
          salesPoint: true,
          items: { include: { product: true } },
        },
      });
    });

    await logAction({ actionType: 'CONCLUIR', module: 'VENDAS', description: `Realizou acerto da remessa #${updated.id} (${updated.salesPoint?.name || 'Banca'}) para status ${updated.status}` });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/consignments error:', error);
    return NextResponse.json({ error: 'Erro ao realizar acerto da remessa' }, { status: 500 });
  }
}

// DELETE - Remover consignação
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    await prisma.consignment.delete({ where: { id: Number(id) } });
    await logAction({ actionType: 'EXCLUIR', module: 'VENDAS', description: `Removeu remessa ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/consignments error:', error);
    return NextResponse.json({ error: 'Erro ao remover remessa' }, { status: 500 });
  }
}
