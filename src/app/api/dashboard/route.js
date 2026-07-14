import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Estoque de Rolos
    const totalRolls = await prisma.filamentRoll.count();
    const lowStockRolls = await prisma.filamentRoll.findMany({
      where: { remainingWeightG: { lt: 200 }, status: { not: 'EMPTY' } },
      orderBy: { remainingWeightG: 'asc' },
    });

    // 2. Ordens de Produção do Mês
    const monthOrders = await prisma.productionOrder.findMany({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
      include: { product: true },
    });

    const completedOrders = monthOrders.filter(o => o.status === 'COMPLETED');
    const failedOrders = monthOrders.filter(o => o.status === 'FAILED');
    const printingOrders = monthOrders.filter(o => o.status === 'PRINTING');

    const totalProductionCost = monthOrders.reduce((sum, o) => sum + Number(o.totalCost || 0), 0);
    const failureCost = failedOrders.reduce((sum, o) => sum + Number(o.totalCost || 0), 0);

    // 3. Vendas e Consignações do Mês
    const settledConsignments = await prisma.consignment.findMany({
      where: {
        settlementDate: { gte: startOfMonth, lte: endOfMonth },
        status: { in: ['SETTLED', 'PARTIAL'] },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    const totalRevenue = settledConsignments.reduce((sum, c) => sum + Number(c.totalSettled || 0), 0);
    const totalCommissionPaid = settledConsignments.reduce((sum, c) => sum + Number(c.totalCommission || 0), 0);
    const totalProfit = settledConsignments.reduce((sum, c) => sum + Number(c.totalProfit || 0), 0);

    // 4. Despesas Fixas e Variáveis
    const fixedExpenses = await prisma.fixedExpense.findMany({
      where: { dueDate: { gte: startOfMonth, lte: endOfMonth } },
    });
    const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const variableExpenses = await prisma.variableExpense.findMany({
      where: { expenseDate: { gte: startOfMonth, lte: endOfMonth } },
    });
    const totalVariableExpenses = variableExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const totalMonthlyCost = totalFixedExpenses + totalVariableExpenses + totalProductionCost + totalCommissionPaid;
    const estimatedNetProfit = totalRevenue - totalMonthlyCost;

    // 5. GERAR SÉRIE TEMPORAL PARA O RECHARTS (Evolução Diária - Últimos 14 dias ou dias do mês)
    const dailyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dailyMap[dateKey] = { date: dateKey, revenue: 0, cost: 0 };
    }

    // Preencher com acertos de remessa reais por data
    settledConsignments.forEach(c => {
      if (c.settlementDate) {
        const dKey = new Date(c.settlementDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (dailyMap[dKey]) {
          dailyMap[dKey].revenue += Number(c.totalSettled || 0);
        }
      }
    });

    // Preencher com custos de produção por data
    monthOrders.forEach(o => {
      const dKey = new Date(o.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (dailyMap[dKey]) {
        dailyMap[dKey].cost += Number(o.totalCost || 0);
      }
    });

    const dailyRevenue = Object.values(dailyMap);

    // 6. TOP PEÇAS VENDIDAS / CONSIGNADAS
    const productSalesMap = {};
    settledConsignments.forEach(c => {
      c.items.forEach(item => {
        const prodName = item.product?.name || 'Peça # ' + item.productId;
        if (!productSalesMap[prodName]) {
          productSalesMap[prodName] = { name: prodName, sold: 0, revenue: 0 };
        }
        productSalesMap[prodName].sold += Number(item.quantitySold || 0);
        productSalesMap[prodName].revenue += Number(item.totalSoldValue || 0);
      });
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // 7. COMPOSIÇÃO DE CUSTOS E SAÍDAS (Donut Chart)
    const costBreakdown = [
      { name: 'Produção / Insumos', value: totalProductionCost, color: '#6366f1' },
      { name: 'Comissões das Bancas', value: totalCommissionPaid, color: '#06b6d4' },
      { name: 'Despesas Fixas', value: totalFixedExpenses, color: '#f59e0b' },
      { name: 'Despesas Variáveis', value: totalVariableExpenses, color: '#ec4899' },
    ].filter(item => item.value > 0);

    return NextResponse.json({
      inventory: { totalRolls, lowStockRolls, lowStockCount: lowStockRolls.length },
      production: {
        total: monthOrders.length,
        completed: completedOrders.length,
        failed: failedOrders.length,
        printing: printingOrders.length,
        queued: monthOrders.filter(o => o.status === 'QUEUED').length,
      },
      financial: {
        totalRevenue,
        totalProfit,
        totalCommissionPaid,
        totalProductionCost,
        failureCost,
        totalFixedExpenses,
        totalVariableExpenses,
        totalMonthlyCost,
        estimatedNetProfit,
      },
      charts: {
        dailyRevenue,
        topProducts,
        costBreakdown,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'Erro ao calcular métricas' }, { status: 500 });
  }
}
