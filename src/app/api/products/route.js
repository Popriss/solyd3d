import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateCostPerGram, calculateSuggestedPrice, calculateMaterialCost, calculateEnergyCost, calculateTotalCost } from '@/lib/calculations';
import { logAction } from '@/lib/activityLogger';

export async function GET() {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });

    // Buscar config de energia e um filamento de referência para custeio
    const energyConfig = await prisma.energyConfig.findFirst({ orderBy: { effectiveDate: 'desc' } });
    const kwhPrice = energyConfig ? Number(energyConfig.kwhPrice) : 0.85;
    const defaultMachine = await prisma.machine.findFirst({ where: { status: 'ACTIVE' } });
    const powerWatts = defaultMachine ? Number(defaultMachine.powerWatts) : 200;

    const enriched = products.map(p => {
      const enCost = calculateEnergyCost(powerWatts, p.estimatedPrintMinutes, kwhPrice);
      return { ...p, estimatedEnergyCost: enCost };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name, description, projectLink, estimatedWeightG, estimatedPrintMinutes,
      recommendedMaterial, recommendedColor, profitMarginPct, imageUrl,
      salePrice, powerWatts,
      color1, weight1G, time1Min, color2, weight2G, time2Min, color3, weight3G, time3Min,
      extra1Name, extra1Qty, extra2Name, extra2Qty
    } = body;

    if (!name || !estimatedWeightG || !estimatedPrintMinutes) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        projectLink: projectLink || null,
        estimatedWeightG: Number(estimatedWeightG),
        estimatedPrintMinutes: Number(estimatedPrintMinutes),
        recommendedMaterial: recommendedMaterial || null,
        recommendedColor: recommendedColor || null,
        profitMarginPct: Number(profitMarginPct || 50),
        salePrice: salePrice !== undefined && salePrice !== '' ? Number(salePrice) : null,
        powerWatts: powerWatts !== undefined && powerWatts !== '' ? Number(powerWatts) : null,
        imageUrl: imageUrl || null,
        color1: color1 || null,
        weight1G: weight1G !== undefined && weight1G !== '' ? Number(weight1G) : null,
        time1Min: time1Min !== undefined && time1Min !== '' ? Number(time1Min) : null,
        color2: color2 || null,
        weight2G: weight2G !== undefined && weight2G !== '' ? Number(weight2G) : null,
        time2Min: time2Min !== undefined && time2Min !== '' ? Number(time2Min) : null,
        color3: color3 || null,
        weight3G: weight3G !== undefined && weight3G !== '' ? Number(weight3G) : null,
        time3Min: time3Min !== undefined && time3Min !== '' ? Number(time3Min) : null,
        extra1Name: extra1Name || null,
        extra1Qty: extra1Qty !== undefined && extra1Qty !== '' ? Number(extra1Qty) : null,
        extra2Name: extra2Name || null,
        extra2Qty: extra2Qty !== undefined && extra2Qty !== '' ? Number(extra2Qty) : null,
      },
    });
    await logAction({ actionType: 'CRIAR', module: 'PRODUTOS', description: `Cadastrou peça/produto no catálogo: ${product.name}` });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    if (data.estimatedWeightG !== undefined) data.estimatedWeightG = Number(data.estimatedWeightG);
    if (data.estimatedPrintMinutes !== undefined) data.estimatedPrintMinutes = Number(data.estimatedPrintMinutes);
    if (data.profitMarginPct !== undefined) data.profitMarginPct = Number(data.profitMarginPct);
    if (data.salePrice !== undefined && data.salePrice !== '') data.salePrice = Number(data.salePrice);
    if (data.powerWatts !== undefined && data.powerWatts !== '') data.powerWatts = Number(data.powerWatts);

    if (data.weight1G !== undefined && data.weight1G !== '') data.weight1G = Number(data.weight1G);
    if (data.time1Min !== undefined && data.time1Min !== '') data.time1Min = Number(data.time1Min);
    if (data.weight2G !== undefined && data.weight2G !== '') data.weight2G = Number(data.weight2G);
    if (data.time2Min !== undefined && data.time2Min !== '') data.time2Min = Number(data.time2Min);
    if (data.weight3G !== undefined && data.weight3G !== '') data.weight3G = Number(data.weight3G);
    if (data.time3Min !== undefined && data.time3Min !== '') data.time3Min = Number(data.time3Min);
    if (data.extra1Qty !== undefined && data.extra1Qty !== '') data.extra1Qty = Number(data.extra1Qty);
    if (data.extra2Qty !== undefined && data.extra2Qty !== '') data.extra2Qty = Number(data.extra2Qty);

    const product = await prisma.product.update({ where: { id: Number(id) }, data });
    await logAction({ actionType: 'ATUALIZAR', module: 'PRODUTOS', description: `Atualizou produto #${product.id} (${product.name})` });
    return NextResponse.json(product);
  } catch (error) {
    console.error('PUT /api/products error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await prisma.product.delete({ where: { id: Number(id) } });
    await logAction({ actionType: 'EXCLUIR', module: 'PRODUTOS', description: `Removeu peça/produto ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao remover produto' }, { status: 500 });
  }
}
