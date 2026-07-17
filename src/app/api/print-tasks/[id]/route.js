import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// PUT /api/print-tasks/[id] -> Permite editar targetCycles, machineId, filamentRollId, status
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const taskId = Number(id);
    if (!taskId) {
      return NextResponse.json({ error: 'ID da tarefa obrigatório' }, { status: 400 });
    }

    const body = await request.json();
    const { targetCycles, machineId, filamentRollId, status } = body;

    const existingTask = await prisma.printTask.findUnique({
      where: { id: taskId },
      include: { productionOrder: { include: { printTasks: true } } },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'PrintTask não encontrada' }, { status: 404 });
    }

    const updateData = {};
    if (machineId !== undefined) updateData.machineId = machineId ? Number(machineId) : null;
    if (filamentRollId !== undefined) updateData.filamentRollId = filamentRollId ? Number(filamentRollId) : null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'PRINTING' && !existingTask.startedAt) updateData.startedAt = new Date();
      if (status === 'COMPLETED') updateData.finishedAt = new Date();
    }

    if (targetCycles !== undefined) {
      const newTarget = Math.max(1, Number(targetCycles));
      updateData.targetCycles = newTarget;

      // Se o novo target for maior que os ciclos concluídos e a tarefa estava COMPLETED, volta para PRINTING/QUEUED
      if (newTarget > existingTask.completedCycles && existingTask.status === 'COMPLETED') {
        updateData.status = 'PRINTING';
        updateData.finishedAt = null;
      }
      // Se reduziu o target para <= aos já concluídos, marca como COMPLETED
      else if (newTarget <= existingTask.completedCycles && existingTask.status !== 'COMPLETED') {
        updateData.status = 'COMPLETED';
        updateData.finishedAt = new Date();
      }
    }

    const updatedTask = await prisma.printTask.update({
      where: { id: taskId },
      data: updateData,
      include: { productPlate: true, machine: true, filamentRoll: true },
    });

    // Re-avalia a Ordem Pai se alguma chapa mudou de status
    const allTasks = await prisma.printTask.findMany({
      where: { productionOrderId: existingTask.productionOrderId },
    });
    const allCompleted = allTasks.every((t) => t.status === 'COMPLETED');

    await prisma.productionOrder.update({
      where: { id: existingTask.productionOrderId },
      data: {
        status: allCompleted ? 'COMPLETED' : 'PRINTING',
        finishedAt: allCompleted ? new Date() : null,
      },
    });

    await logAction({
      actionType: 'ATUALIZAR',
      module: 'PRODUCAO',
      description: `Atualizou chapa #${updatedTask.id} (${updatedTask.productPlate.name}): ${updatedTask.completedCycles}/${updatedTask.targetCycles} ciclos.`,
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('PUT /api/print-tasks/[id] error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 });
  }
}
