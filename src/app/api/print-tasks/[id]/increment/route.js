import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { determineFilamentStatus } from '@/lib/calculations';
import { logAction } from '@/lib/activityLogger';

// PUT /api/print-tasks/[id]/increment -> Incrementa +1 ciclo concluído e reduz estoque da chapa
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const taskId = Number(id);
    if (!taskId) {
      return NextResponse.json({ error: 'ID da tarefa obrigatório' }, { status: 400 });
    }

    const task = await prisma.printTask.findUnique({
      where: { id: taskId },
      include: {
        productPlate: true,
        filamentRoll: true,
        productionOrder: {
          include: { printTasks: true, filamentRoll: true, machine: true, product: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    if (task.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Esta tarefa de chapa já atingiu o total de ciclos!' }, { status: 400 });
    }

    const newCompleted = task.completedCycles + 1;
    const isNowFinished = newCompleted >= task.targetCycles;
    const newStatus = isNowFinished ? 'COMPLETED' : 'PRINTING';

    const rollToDebitId = task.filamentRollId || task.productionOrder.filamentRollId;
    const granularConfig = await prisma.systemConfig.findUnique({ where: { key: 'modo_estoque_granular' } });
    const isGranular = granularConfig?.value === 'true';

    await prisma.$transaction(async (tx) => {
      if (isGranular && rollToDebitId) {
        const roll = await tx.filamentRoll.findUnique({ where: { id: rollToDebitId } });
        if (roll) {
          const weightToSubtract = Number(task.productPlate.estimatedWeightG || 0);
          const currentRemaining = Number(roll.remainingWeightG ?? roll.initialWeightG);
          const newRemaining = Math.max(0, currentRemaining - weightToSubtract);

          await tx.filamentRoll.update({
            where: { id: roll.id },
            data: {
              remainingWeightG: newRemaining,
              status: determineFilamentStatus(newRemaining),
              active: newRemaining > 0,
            },
          });
        }
      }

      await tx.printTask.update({
        where: { id: taskId },
        data: {
          completedCycles: newCompleted,
          status: newStatus,
          startedAt: task.startedAt || new Date(),
          finishedAt: isNowFinished ? new Date() : null,
        },
      });

      const allTasks = task.productionOrder.printTasks;
      const allOtherTasksCompleted = allTasks
        .filter((t) => t.id !== taskId)
        .every((t) => t.status === 'COMPLETED');

      if (isNowFinished && allOtherTasksCompleted) {
        await tx.productionOrder.update({
          where: { id: task.productionOrderId },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });

        await tx.product.update({
          where: { id: task.productionOrder.productId },
          data: { stockReady: { increment: task.productionOrder.targetQuantity } },
        });

        if (task.productionOrder.saleId) {
          await tx.sale.update({
            where: { id: task.productionOrder.saleId },
            data: { status: 'DELIVERED' },
          });
        }

        await logAction({
          actionType: 'CONCLUIR',
          module: 'PRODUCAO',
          description: `Lote BOM #${task.productionOrderId} finalizado 100%! Peças adicionadas ao estoque pronto.`,
        });
      }
    });

    const updatedResult = await prisma.printTask.findUnique({
      where: { id: taskId },
      include: {
        productPlate: true,
        machine: true,
        filamentRoll: true,
        productionOrder: { include: { printTasks: { include: { productPlate: true } } } },
      },
    });

    return NextResponse.json(updatedResult);
  } catch (error) {
    console.error('PUT /api/print-tasks/[id]/increment error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao incrementar ciclo' }, { status: 500 });
  }
}
