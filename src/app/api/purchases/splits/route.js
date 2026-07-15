import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// PUT - Quitar / dar baixa em uma parcela de rateio pendente de um sócio
export async function PUT(request) {
  try {
    const body = await request.json();
    const { splitId, amountPaid, installmentsPaid } = body;

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

    // Se amountPaid for passado, usamos ele. Se não for, assumimos quitação integral do valor esperado.
    const newAmountPaid = amountPaid !== undefined && amountPaid !== null ? Number(amountPaid) : Number(split.amountExpected);
    
    // Se installmentsPaid for passado, usamos. Caso contrário, se o novo amountPaid quitou o total, usamos o total de parcelas da compra (ou 1).
    const newInstallmentsPaid = installmentsPaid !== undefined && installmentsPaid !== null
      ? Number(installmentsPaid)
      : (newAmountPaid >= Number(split.amountExpected) - 0.01 ? (split.purchase?.installmentCount || 1) : Number(split.installmentsPaid || 0));

    const isTotalSettled = newAmountPaid >= Number(split.amountExpected) - 0.01 || (split.purchase?.installmentCount && newInstallmentsPaid >= split.purchase.installmentCount);
    const newStatus = isTotalSettled ? 'SETTLED' : 'PENDING';

    const updated = await prisma.purchaseSplit.update({
      where: { id: Number(splitId) },
      data: {
        amountPaid: newAmountPaid,
        installmentsPaid: newInstallmentsPaid,
        status: newStatus,
      },
      include: {
        partner: true,
        purchase: true,
      },
    });

    const descMsg = installmentsPaid !== undefined && installmentsPaid !== null
      ? `Quitou ${newInstallmentsPaid} parcela(s) (Total Pago: R$ ${newAmountPaid.toFixed(2)}) da cota de ${split.partner.name} (Compra #${split.purchaseId}: ${split.purchase.description})`
      : `Quitou R$ ${newAmountPaid.toFixed(2)} da cota de rateio de ${split.partner.name} (Compra #${split.purchaseId}: ${split.purchase.description})`;

    await logAction({
      actionType: 'CONCLUIR',
      module: 'COMPRAS',
      description: descMsg,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/purchases/splits error:', error);
    return NextResponse.json({ error: 'Erro ao quitar parcela do rateio' }, { status: 500 });
  }
}
