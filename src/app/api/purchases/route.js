import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// GET - Listar todas as compras/despesas registradas
export async function GET() {
  try {
    const purchases = await prisma.purchase.findMany({
      orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        paidByPartner: true,
        splits: {
          include: {
            partner: true,
          },
        },
      },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error('GET /api/purchases error:', error);
    return NextResponse.json({ error: 'Erro ao buscar compras e despesas' }, { status: 500 });
  }
}

// POST - Criar nova compra e gerar rateio se for financiada por Aporte de Sócios
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      description,
      amount,
      paymentMethod,
      fundingSource,
      paidByPartnerId,
      partnerIds,
      purchaseDate,
      notes,
    } = body;

    if (!description || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Descrição e Valor Total (> 0) são obrigatórios' }, { status: 400 });
    }

    if (!fundingSource || (fundingSource !== 'BUSINESS_CASH' && fundingSource !== 'PARTNER_CONTRIBUTION')) {
      return NextResponse.json({ error: 'Origem do dinheiro inválida (Caixa do Negócio ou Aporte de Sócios)' }, { status: 400 });
    }

    if (fundingSource === 'PARTNER_CONTRIBUTION' && (!Array.isArray(partnerIds) || partnerIds.length === 0)) {
      return NextResponse.json({ error: 'Selecione pelo menos um sócio para a divisão/rateio da despesa' }, { status: 400 });
    }

    const totalAmount = Number(amount);
    const dateToSave = purchaseDate ? new Date(purchaseDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar o registro de compra
      const purchase = await tx.purchase.create({
        data: {
          description: description.trim(),
          amount: totalAmount,
          paymentMethod: paymentMethod || 'PIX', // CREDIT_CARD, DEBIT_CARD, PIX
          fundingSource,
          paidByPartnerId: paidByPartnerId ? Number(paidByPartnerId) : null,
          purchaseDate: dateToSave,
          notes: notes ? notes.trim() : null,
        },
      });

      // 2. Se for Aporte de Sócios, criar a divisão (rateio) em PurchaseSplit
      if (fundingSource === 'PARTNER_CONTRIBUTION' && partnerIds && partnerIds.length > 0) {
        const expectedPerPerson = Number((totalAmount / partnerIds.length).toFixed(2));
        const splitsData = [];

        for (const pid of partnerIds) {
          const partnerIdNum = Number(pid);
          // Se houve um pagante integral antecipado (paidByPartnerId) e este sócio é ele,
          // consideramos sua cota de rateio já quitada no ato
          const isPayer = paidByPartnerId && partnerIdNum === Number(paidByPartnerId);

          splitsData.push({
            purchaseId: purchase.id,
            partnerId: partnerIdNum,
            amountExpected: expectedPerPerson,
            amountPaid: isPayer ? expectedPerPerson : 0,
            status: isPayer ? 'SETTLED' : 'PENDING',
          });
        }

        await tx.purchaseSplit.createMany({
          data: splitsData,
        });
      }

      return await tx.purchase.findUnique({
        where: { id: purchase.id },
        include: {
          paidByPartner: true,
          splits: { include: { partner: true } },
        },
      });
    });

    const sourceLabel = fundingSource === 'BUSINESS_CASH' ? 'Caixa de Vendas' : `Rateio entre ${partnerIds?.length || 1} Sócios`;
    await logAction({
      actionType: 'CRIAR',
      module: 'COMPRAS',
      description: `Registrou compra: ${result.description} (R$ ${totalAmount.toFixed(2)} via ${sourceLabel})`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/purchases error:', error);
    return NextResponse.json({ error: 'Erro ao registrar compra' }, { status: 500 });
  }
}

// DELETE - Remover compra e seus rateios associados
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID da compra é obrigatório' }, { status: 400 });
    }

    const purchaseId = Number(id);
    const existing = await prisma.purchase.findUnique({ where: { id: purchaseId } });

    if (!existing) {
      return NextResponse.json({ error: 'Compra não encontrada' }, { status: 404 });
    }

    await prisma.purchase.delete({ where: { id: purchaseId } });

    await logAction({
      actionType: 'EXCLUIR',
      module: 'COMPRAS',
      description: `Removeu a compra/despesa ID #${purchaseId} (${existing.description})`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/purchases error:', error);
    return NextResponse.json({ error: 'Erro ao remover compra' }, { status: 500 });
  }
}
