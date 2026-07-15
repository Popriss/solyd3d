import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Buscar todos os sócios ativos para a matriz completa
    const partners = await prisma.partner.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    // 2. Buscar todas as parcelas de rateio pendentes
    const pendingSplits = await prisma.purchaseSplit.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        partner: true,
        purchase: {
          include: {
            paidByPartner: true,
          },
        },
      },
    });

    const namesMap = {
      COMPANY: '🏢 Conta da Empresa',
    };

    partners.forEach((p) => {
      namesMap[String(p.id)] = p.name;
    });

    // 3. Acumular dívidas brutas bilaterais
    // grossDebts[devedorId][credorId] = valor
    const grossDebts = {};
    let totalGrossDebt = 0;

    for (const split of pendingSplits) {
      const pendingVal = Number(split.amountExpected) - Number(split.amountPaid);
      if (pendingVal <= 0.01) continue;

      const debtorId = String(split.partnerId);
      const debtorName = split.partner?.name || 'Sócio';
      namesMap[debtorId] = debtorName;

      let creditorId = 'COMPANY';
      let creditorName = '🏢 Conta da Empresa';

      if (split.purchase?.paidByPartnerId) {
        creditorId = String(split.purchase.paidByPartnerId);
        creditorName = split.purchase.paidByPartner?.name || 'Sócio Credor';
        namesMap[creditorId] = creditorName;
      }

      // Se o devedor e credor forem a mesma pessoa, não há dívida (ex: pagou a própria conta)
      if (debtorId === creditorId) continue;

      if (!grossDebts[debtorId]) grossDebts[debtorId] = {};
      grossDebts[debtorId][creditorId] = (grossDebts[debtorId][creditorId] || 0) + pendingVal;
      totalGrossDebt += pendingVal;
    }

    // 4. Compensação Direta Bilateral (Netting)
    const netDebts = [];
    const processedPairs = new Set();

    const allParties = Object.keys(namesMap);

    for (let i = 0; i < allParties.length; i++) {
      for (let j = i + 1; j < allParties.length; j++) {
        const partyA = allParties[i];
        const partyB = allParties[j];

        const pairKey = `${partyA}_${partyB}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const debtAtoB = grossDebts[partyA]?.[partyB] || 0;
        const debtBtoA = grossDebts[partyB]?.[partyA] || 0;

        if (debtAtoB > debtBtoA) {
          const net = debtAtoB - debtBtoA;
          if (net > 0.01) {
            netDebts.push({
              debtorId: partyA,
              debtorName: namesMap[partyA],
              creditorId: partyB,
              creditorName: namesMap[partyB],
              netAmount: Number(net.toFixed(2)),
              grossOriginal: Number(debtAtoB.toFixed(2)),
              nettedSavings: Number(debtBtoA.toFixed(2)),
            });
          }
        } else if (debtBtoA > debtAtoB) {
          const net = debtBtoA - debtAtoB;
          if (net > 0.01) {
            netDebts.push({
              debtorId: partyB,
              debtorName: namesMap[partyB],
              creditorId: partyA,
              creditorName: namesMap[partyA],
              netAmount: Number(net.toFixed(2)),
              grossOriginal: Number(debtBtoA.toFixed(2)),
              nettedSavings: Number(debtAtoB.toFixed(2)),
            });
          }
        }
        // Se debtAtoB === debtBtoA e forem > 0, ambos se anulam 100%, resultando em saldo 0
      }
    }

    // Ordenar dívidas líquidas por valor (maior para menor)
    netDebts.sort((a, b) => b.netAmount - a.netAmount);

    const totalNetDebt = netDebts.reduce((acc, curr) => acc + curr.netAmount, 0);
    const totalSavedByNetting = totalGrossDebt - totalNetDebt;

    // 5. Calcular balanço individual consolidado de cada participante
    const participantsSummary = {};
    allParties.forEach((id) => {
      participantsSummary[id] = {
        id,
        name: namesMap[id],
        isCompany: id === 'COMPANY',
        totalToPay: 0,
        totalToReceive: 0,
        netBalance: 0,
        debtsDetails: [], // para quem esta pessoa deve pagar diretamente (já compensado)
        receivablesDetails: [], // quem deve pagar para esta pessoa (já compensado)
      };
    });

    netDebts.forEach((item) => {
      if (participantsSummary[item.debtorId]) {
        participantsSummary[item.debtorId].totalToPay += item.netAmount;
        participantsSummary[item.debtorId].debtsDetails.push({
          targetId: item.creditorId,
          targetName: item.creditorName,
          amount: item.netAmount,
          savings: item.nettedSavings,
        });
      }
      if (participantsSummary[item.creditorId]) {
        participantsSummary[item.creditorId].totalToReceive += item.netAmount;
        participantsSummary[item.creditorId].receivablesDetails.push({
          sourceId: item.debtorId,
          sourceName: item.debtorName,
          amount: item.netAmount,
          savings: item.nettedSavings,
        });
      }
    });

    const summaryList = Object.values(participantsSummary).map((p) => {
      const totalToPay = Number(p.totalToPay.toFixed(2));
      const totalToReceive = Number(p.totalToReceive.toFixed(2));
      const netBalance = Number((totalToReceive - totalToPay).toFixed(2));
      return {
        ...p,
        totalToPay,
        totalToReceive,
        netBalance,
      };
    });

    // Colocar a empresa em primeiro e depois os sócios ordenados por nome
    summaryList.sort((a, b) => {
      if (a.isCompany) return -1;
      if (b.isCompany) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      netDebts,
      participantsSummary: summaryList,
      metrics: {
        totalGrossDebt: Number(totalGrossDebt.toFixed(2)),
        totalNetDebt: Number(totalNetDebt.toFixed(2)),
        totalSavedByNetting: Number(totalSavedByNetting.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('GET /api/purchases/netting error:', error);
    return NextResponse.json({ error: 'Erro ao calcular compensação de dívidas' }, { status: 500 });
  }
}
