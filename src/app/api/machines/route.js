import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

export async function GET() {
  try {
    const machines = await prisma.machine.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(machines);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar máquinas' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, purchasePrice, installmentCount, installmentValue, powerWatts, purchaseDate } = body;
    if (!name || !purchasePrice || !powerWatts) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }
    const machine = await prisma.machine.create({
      data: {
        name,
        purchasePrice: Number(purchasePrice),
        installmentCount: Number(installmentCount || 1),
        installmentValue: Number(installmentValue || purchasePrice),
        powerWatts: Number(powerWatts),
        purchaseDate: new Date(purchaseDate || Date.now()),
      },
    });
    await logAction({ actionType: 'CRIAR', module: 'MAQUINAS', description: `Cadastrou nova impressora 3D: ${machine.name} (${machine.powerWatts}W)` });
    return NextResponse.json(machine, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar máquina' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    if (data.purchasePrice) data.purchasePrice = Number(data.purchasePrice);
    if (data.installmentCount) data.installmentCount = Number(data.installmentCount);
    if (data.installmentValue) data.installmentValue = Number(data.installmentValue);
    if (data.powerWatts) data.powerWatts = Number(data.powerWatts);
    if (data.purchaseDate) data.purchaseDate = new Date(data.purchaseDate);
    const machine = await prisma.machine.update({ where: { id: Number(id) }, data });
    await logAction({ actionType: 'ATUALIZAR', module: 'MAQUINAS', description: `Atualizou dados da impressora #${machine.id} (${machine.name})` });
    return NextResponse.json(machine);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar máquina' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await prisma.machine.delete({ where: { id: Number(id) } });
    await logAction({ actionType: 'EXCLUIR', module: 'MAQUINAS', description: `Removeu impressora 3D ID #${id}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao remover máquina' }, { status: 500 });
  }
}
