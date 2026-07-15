import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// PUT - Quitar / dar baixa em uma parcela de rateio pendente de um sócio
export async function PUT(request) {
  try {
    const body = await request.json();
    const { splitId, amountPaid } = body;

    if (!splitId) {
      return NextResponse.json({ error: 'ID do rateio (splitId) é obrigatório' }, { status: 400 });
    }

    const split = await prisma.purchaseSplit.findUnique({
      where: { id: Number(splitId) },
      include: { partner: true, purchase: true },
    });

    if (!split) {
      return NextResponse.json({ error: 'Registro de rateio não encontrado' }, { status: 404 });
    }

    const newAmountPaid = amountPaid !== undefined ? Number(amountPaid) : Number(split.amountExpected);
    const newStatus = newAmountPaid >= Number(split.amountExpected) ? 'SETTLED' : 'PENDING';

    const updated = await prisma.purchaseSplit.update({
      where: { id: Number(splitId) },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
      include: {
        partner: true,
        purchase: true,
      },
    });

    await logAction({
      actionType: 'CONCLUIR',
      module: 'COMPRAS',
      description: `Quitou/Aportou R$ ${newAmountPaid.toFixed(2)} da cota de rateio de ${split.partner.name} (Compra #${split.purchaseId}: ${split.purchase.description})`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/purchases/splits error:', error);
    return NextResponse.json({ error: 'Erro ao quitar parcela do rateio' }, { status: 500 });
  }
}
