import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateCostPerGram, calculateSuggestedPrice, calculateMaterialCost, calculateEnergyCost, calculateTotalCost } from '@/lib/calculations';

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
    const { name, description, projectLink, estimatedWeightG, estimatedPrintMinutes, recommendedMaterial, recommendedColor, profitMarginPct, imageUrl } = body;
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
        imageUrl: imageUrl || null,
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    if (data.estimatedWeightG) data.estimatedWeightG = Number(data.estimatedWeightG);
    if (data.estimatedPrintMinutes) data.estimatedPrintMinutes = Number(data.estimatedPrintMinutes);
    if (data.profitMarginPct) data.profitMarginPct = Number(data.profitMarginPct);
    const product = await prisma.product.update({ where: { id: Number(id) }, data });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await prisma.product.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao remover produto' }, { status: 500 });
  }
}
