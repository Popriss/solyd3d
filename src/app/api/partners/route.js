import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// GET - Listar sócios com saldos e balanço financeiro de rateio
export async function GET() {
  try {
    const partners = await prisma.partner.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      include: {
        splits: {
          include: {
            purchase: true,
          },
        },
        purchasesPaidBy: true,
      },
    });

    // Enriquecer cada sócio com métricas de rateio (Contas a Receber/Pagar Internas)
    const enriched = partners.map((partner) => {
      let pendingToPay = 0; // Contas onde ele foi rateado e ainda não aportou
      let totalContributed = 0; // Valor total que ele já pagou/aportou em rateios ou adiantamentos
      let totalAdvanced = 0; // Contas totais que ele pagou no ato da compra para os outros

      // 1. Verificar os rateios (splits) atribuídos a este sócio
      for (const split of partner.splits) {
        if (split.status === 'PENDING') {
          pendingToPay += Number(split.amountExpected || 0) - Number(split.amountPaid || 0);
        }
        totalContributed += Number(split.amountPaid || 0);
      }

      // 2. Verificar compras inteiras pagas no ato por este sócio (Antecipação)
      for (const p of partner.purchasesPaidBy) {
        if (p.fundingSource === 'PARTNER_CONTRIBUTION') {
          totalAdvanced += Number(p.amount || 0);
        }
      }

      // Balanço Líquido Interno:
      // (Aportes/Adiantamentos que ele fez) - (As parcelas de rateio que lhe cabem e estão pendentes)
      // Se pagou uma conta inteira de R$ 1000 e eram 2 sócios, ele pagou R$ 1000 (totalAdvanced) e seu rateio esperado era R$ 500.
      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        active: partner.active,
        createdAt: partner.createdAt,
        pendingToPay,
        totalContributed,
        totalAdvanced,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/partners error:', error);
    return NextResponse.json({ error: 'Erro ao buscar sócios' }, { status: 500 });
  }
}

// POST - Criar novo sócio
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome do sócio é obrigatório' }, { status: 400 });
    }

    const partner = await prisma.partner.create({
      data: {
        name: name.trim(),
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        active: true,
      },
    });

    await logAction({
      actionType: 'CRIAR',
      module: 'COMPRAS',
      description: `Cadastrou novo sócio para rateio: ${partner.name}`,
    });

    return NextResponse.json(partner, { status: 201 });
  } catch (error) {
    console.error('POST /api/partners error:', error);
    return NextResponse.json({ error: 'Erro ao cadastrar sócio' }, { status: 500 });
  }
}

// DELETE - Desativar ou remover sócio
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do sócio é obrigatório' }, { status: 400 });
    }

    const partnerId = Number(id);
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { splits: true, purchasesPaidBy: true },
    });

    if (!partner) {
      return NextResponse.json({ error: 'Sócio não encontrado' }, { status: 404 });
    }

    // Se o sócio tiver pendências ou histórico, fazemos soft delete desativando
    if (partner.splits.length > 0 || partner.purchasesPaidBy.length > 0) {
      await prisma.partner.update({
        where: { id: partnerId },
        data: { active: false },
      });
    } else {
      await prisma.partner.delete({
        where: { id: partnerId },
      });
    }

    await logAction({
      actionType: 'EXCLUIR',
      module: 'COMPRAS',
      description: `Removeu/Desativou o sócio: ${partner.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/partners error:', error);
    return NextResponse.json({ error: 'Erro ao remover sócio' }, { status: 500 });
  }
}
