import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function logAction({ actionType, module, description, customUser = null }) {
  try {
    let userName = customUser?.name || 'Sistema / Operacional';
    let userEmail = customUser?.email || 'operador@solyd3d.com';

    if (!customUser) {
      try {
        const session = await getServerSession(authOptions);
        if (session?.user) {
          userName = session.user.name || userName;
          userEmail = session.user.email || userEmail;
        }
      } catch {
        /* falha silenciosa se não houver sessão ativa no contexto */
      }
    }

    await prisma.activityLog.create({
      data: {
        userName,
        userEmail,
        actionType,
        module,
        description,
      },
    });
  } catch (err) {
    console.error('Falha ao registrar ação no ActivityLog:', err);
  }
}
