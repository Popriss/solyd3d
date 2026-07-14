import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// GET - Listar todos os pontos de venda com suas estatísticas agregadas
export async function GET() {
  try {
    const points = await prisma.salesPoint.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        consignments: {
          include: {
            items: true,
          },
        },
      },
    });

    // Enriquecer cada ponto de venda com métricas de itens na banca e total faturado
    const enriched = points.map((point) => {
      let activeItemsCount = 0;
      let totalRevenue = 0;
      let totalProfit = 0;

      for (const c of point.consignments) {
        if (c.status === 'PENDING' || c.status === 'PARTIAL') {
          for (const item of c.items) {
            const remainingInStore = item.quantitySent - item.quantitySold - item.quantityReturned - item.quantityLost;
            if (remainingInStore > 0) {
              activeItemsCount += remainingInStore;
            }
          }
        }
        totalRevenue += Number(c.totalSettled || 0);
        totalProfit += Number(c.totalProfit || 0);
      }

      const { consignments, ...rest } = point;
      return {
        ...rest,
        activeItemsCount,
        totalRevenue,
        totalProfit,
        consignmentsCount: consignments.length,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/sales-points error:', error);
    return NextResponse.json({ error: 'Erro ao buscar pontos de venda' }, { status: 500 });
  }
}

// POST - Criar novo ponto de venda
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, type, location, contactName, contactPhone, commissionPct, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome do ponto é obrigatório' }, { status: 400 });
    }

    const point = await prisma.salesPoint.create({
      data: {
        name,
        type: type || 'BANCA',
        location: location || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        commissionPct: Number(commissionPct ?? 15),
        notes: notes || null,
        status: 'ACTIVE',
      },
    });

    await logAction({ actionType: 'CRIAR', module: 'VENDAS', description: `Cadastrou ponto de venda/banca: ${point.name}` });

    return NextResponse.json(point, { status: 201 });
  } catch (error) {
    console.error('POST /api/sales-points error:', error);
    return NextResponse.json({ error: 'Erro ao criar ponto de venda' }, { status: 500 });
  }
}

// PUT - Atualizar ponto de venda
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    if (data.commissionPct !== undefined) {
      data.commissionPct = Number(data.commissionPct);
    }

    const updated = await prisma.salesPoint.update({
      where: { id: Number(id) },
      data,
    });

    await logAction({ actionType: 'ATUALIZAR', module: 'VENDAS', description: `Atualizou ponto de venda #${updated.id} (${updated.name})` });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/sales-points error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar ponto de venda' }, { status: 500 });
  }
}

// DELETE - Remover ponto de venda
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    }

    await prisma.salesPoint.delete({ where: { id: Number(id) } });
    await logAction({ actionType: 'EXCLUIR', module: 'VENDAS', description: `Removeu ponto de venda ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/sales-points error:', error);
    return NextResponse.json({ error: 'Erro ao remover ponto de venda' }, { status: 500 });
  }
}
