import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// GET - Listar todas as vendas
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const sale = await prisma.sale.findUnique({
        where: { id: Number(id) },
        include: {
          items: {
            include: {
              product: true,
              productionOrders: true,
            },
          },
          productionOrders: true,
          salesPoint: true,
        },
      });
      return NextResponse.json(sale);
    }

    const sales = await prisma.sale.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        productionOrders: true,
        salesPoint: true,
      },
    });

    return NextResponse.json(sales);
  } catch (error) {
    console.error('GET /api/sales error:', error);
    return NextResponse.json({ error: 'Erro ao buscar vendas' }, { status: 500 });
  }
}

// POST - Criar nova Venda com Gatilho de Produção (OP Automática)
export async function POST(request) {
  try {
    const body = await request.json();
    const { salesPointId, customerName, customerContact, notes, items } = body;

    if (!customerName || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cliente e pelo menos 1 item são obrigatórios' }, { status: 400 });
    }

    // Carregar rolo ativo e máquina ativa para o gatilho automático da OP
    const activeRoll = await prisma.filamentRoll.findFirst({ where: { active: true } }) || await prisma.filamentRoll.findFirst();
    const activeMachine = await prisma.machine.findFirst({ where: { status: 'ACTIVE' } }) || await prisma.machine.findFirst();

    if (!activeRoll || !activeMachine) {
      return NextResponse.json({ error: 'Para iniciar uma venda com ordem de produção, cadastre pelo menos 1 Filamento Ativo e 1 Máquina no sistema.' }, { status: 400 });
    }

    // Calcular totais usando o catálogo oculto no backend
    let totalAmount = 0;
    let estimatedPrintMinutes = 0;

    // Criar a Venda em transação com seus itens e disparar as OPs
    const newSale = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.sale.create({
        data: {
          salesPointId: salesPointId ? Number(salesPointId) : null,
          customerName,
          customerContact: customerContact || null,
          notes: notes || null,
          status: 'ACTIVE',
        },
      });

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: Number(item.productId) } });
        if (!product) continue;

        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice) || Number(product.salePrice || 0);
        const itemTotal = unitPrice * qty;
        const itemMinutes = (Number(product.estimatedPrintMinutes) || 60) * qty;

        // Estimativa oculta de custo unitário (g * custo do grama + energia média)
        const costPerGram = Number(activeRoll.costPerRoll || 150) / Number(activeRoll.initialWeightG || 1000);
        const unitCost = Number(product.estimatedWeightG || 50) * costPerGram + 3.0; // custo médio peça

        totalAmount += itemTotal;
        estimatedPrintMinutes += itemMinutes;

        const createdItem = await tx.saleItem.create({
          data: {
            saleId: createdSale.id,
            productId: product.id,
            quantity: qty,
            unitPrice,
            unitCost,
            totalPrice: itemTotal,
            estimatedMinutes: itemMinutes,
          },
        });

        // GATILHO DE PRODUÇÃO: Criar Ordem de Produção (OP) vinculada ao item da venda
        await tx.productionOrder.create({
          data: {
            productId: product.id,
            filamentRollId: activeRoll.id,
            machineId: activeMachine.id,
            status: 'QUEUED',
            quantity: qty,
            destinationType: salesPointId ? 'SALES_POINT' : 'DIRECT_SALE',
            destinationName: customerName,
            saleId: createdSale.id,
            saleItemId: createdItem.id,
            notes: `[Venda #${createdSale.id}] ${qty}x ${product.name} para ${customerName}${notes ? ' — ' + notes : ''}`,
          },
        });
      }

      // Atualizar totais consolidados na Venda
      return await tx.sale.update({
        where: { id: createdSale.id },
        data: {
          totalAmount,
          estimatedPrintMinutes,
        },
        include: {
          items: { include: { product: true } },
          productionOrders: true,
        },
      });
    });

    await logAction({
      userName: 'Sistema',
      userEmail: 'sistema@solyd3d.com',
      actionType: 'CRIAR',
      module: 'VENDAS',
      description: `Iniciada Venda Direta #${newSale.id} para ${customerName} total R$ ${newSale.totalAmount.toFixed(2)} com Ordem de Produção disparada.`,
    });

    return NextResponse.json(newSale, { status: 201 });
  } catch (error) {
    console.error('POST /api/sales error:', error);
    return NextResponse.json({ error: 'Erro ao criar venda: ' + error.message }, { status: 500 });
  }
}

// PUT - Atualizar itens (com verificação de bloqueio por OP) ou Dar Baixa de Pagamento (com comprovante obrigatório)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, action, proofFileUrl, proofFileName, status, notes, items, customerName, customerContact } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID da venda obrigatório' }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { productionOrders: true, items: true },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
    }

    // 1. AÇÃO: DAR BAIXA / PAGAMENTO REALIZADO (Mandatory Proof Check)
    if (action === 'CONFIRM_PAYMENT' || status === 'PAID') {
      const fileToSave = proofFileUrl || sale.proofFileUrl;
      if (!fileToSave) {
        return NextResponse.json({
          error: 'Comprovante obrigatório! Anexe o arquivo (print de PIX, Nota fiscal ou PDF) para dar baixa na Venda.'
        }, { status: 400 });
      }

      const updated = await prisma.sale.update({
        where: { id: sale.id },
        data: {
          status: 'PAID',
          proofFileUrl: fileToSave,
          proofFileName: proofFileName || sale.proofFileName || 'comprovante_pagamento.pdf',
          notes: notes !== undefined ? notes : sale.notes,
        },
        include: { items: { include: { product: true } }, productionOrders: true },
      });

      await logAction({
        userName: 'Usuário',
        userEmail: 'admin@solyd3d.com',
        actionType: 'CONCLUIR',
        module: 'VENDAS',
        description: `Baixa de pagamento confirmada na Venda #${sale.id} (${sale.customerName}) com comprovante anexado.`,
      });

      return NextResponse.json(updated);
    }

    // 2. AÇÃO: ATUALIZAR ITENS / QUANTIDADE (Edit Locking based on OP status)
    if (action === 'UPDATE_ITEMS' || items) {
      // Verificar se alguma Ordem de Produção atrelada está em andamento (PRINTING ou COMPLETED)
      const isLocked = sale.productionOrders.some(op => op.status === 'PRINTING' || op.status === 'COMPLETED');
      if (isLocked) {
        return NextResponse.json({
          error: 'Produção em andamento ou concluída. Impossível alterar a quantidade desta venda.'
        }, { status: 400 });
      }

      // Se a OP está na fila (QUEUED), permitimos a alteração e sincronizamos as OPs
      const activeRoll = await prisma.filamentRoll.findFirst({ where: { active: true } }) || await prisma.filamentRoll.findFirst();
      const activeMachine = await prisma.machine.findFirst({ where: { status: 'ACTIVE' } }) || await prisma.machine.findFirst();

      const updatedSale = await prisma.$transaction(async (tx) => {
        // Remover itens e OPs anteriores (já que estão apenas em QUEUED)
        await tx.productionOrder.deleteMany({ where: { saleId: sale.id } });
        await tx.saleItem.deleteMany({ where: { saleId: sale.id } });

        let totalAmount = 0;
        let estimatedPrintMinutes = 0;

        for (const item of items) {
          const product = await tx.product.findUnique({ where: { id: Number(item.productId) } });
          if (!product) continue;

          const qty = Number(item.quantity) || 1;
          const unitPrice = Number(item.unitPrice) || Number(product.salePrice || 0);
          const itemTotal = unitPrice * qty;
          const itemMinutes = (Number(product.estimatedPrintMinutes) || 60) * qty;

          const costPerGram = activeRoll ? Number(activeRoll.costPerRoll || 150) / Number(activeRoll.initialWeightG || 1000) : 0.15;
          const unitCost = Number(product.estimatedWeightG || 50) * costPerGram + 3.0;

          totalAmount += itemTotal;
          estimatedPrintMinutes += itemMinutes;

          const createdItem = await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: product.id,
              quantity: qty,
              unitPrice,
              unitCost,
              totalPrice: itemTotal,
              estimatedMinutes: itemMinutes,
            },
          });

          if (activeRoll && activeMachine) {
            await tx.productionOrder.create({
              data: {
                productId: product.id,
                filamentRollId: activeRoll.id,
                machineId: activeMachine.id,
                status: 'QUEUED',
                quantity: qty,
                destinationType: sale.salesPointId ? 'SALES_POINT' : 'DIRECT_SALE',
                destinationName: customerName || sale.customerName,
                saleId: sale.id,
                saleItemId: createdItem.id,
                notes: `[Venda #${sale.id} Atualizada] ${qty}x ${product.name} para ${customerName || sale.customerName}`,
              },
            });
          }
        }

        return await tx.sale.update({
          where: { id: sale.id },
          data: {
            customerName: customerName || sale.customerName,
            customerContact: customerContact !== undefined ? customerContact : sale.customerContact,
            notes: notes !== undefined ? notes : sale.notes,
            totalAmount,
            estimatedPrintMinutes,
          },
          include: { items: { include: { product: true } }, productionOrders: true },
        });
      });

      return NextResponse.json(updatedSale);
    }

    // Apenas atualização de dados simples (nome, notas)
    const updatedSimple = await prisma.sale.update({
      where: { id: sale.id },
      data: {
        customerName: customerName || sale.customerName,
        customerContact: customerContact !== undefined ? customerContact : sale.customerContact,
        notes: notes !== undefined ? notes : sale.notes,
        status: status || sale.status,
      },
      include: { items: { include: { product: true } }, productionOrders: true },
    });

    return NextResponse.json(updatedSimple);
  } catch (error) {
    console.error('PUT /api/sales error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar venda: ' + error.message }, { status: 500 });
  }
}

// DELETE - Cancelar ou excluir venda se não estiver produzindo
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da venda obrigatório' }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { productionOrders: true },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
    }

    const isLocked = sale.productionOrders.some(op => op.status === 'PRINTING');
    if (isLocked) {
      return NextResponse.json({ error: 'A produção desta venda está em andamento no momento. Não é possível excluir.' }, { status: 400 });
    }

    // Excluir OPs vinculadas em QUEUED e depois a Venda
    await prisma.productionOrder.deleteMany({ where: { saleId: sale.id } });
    await prisma.sale.delete({ where: { id: sale.id } });

    await logAction({
      userName: 'Usuário',
      userEmail: 'admin@solyd3d.com',
      actionType: 'EXCLUIR',
      module: 'VENDAS',
      description: `Venda Direta #${sale.id} (${sale.customerName}) foi excluída/cancelada.`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sales error:', error);
    return NextResponse.json({ error: 'Erro ao excluir venda' }, { status: 500 });
  }
}
