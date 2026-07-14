import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAction } from '@/lib/activityLogger';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar usuários do sistema' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Já existe um usuário cadastrado com este e-mail.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    await logAction({ actionType: 'CRIAR', module: 'USUARIOS', description: `Cadastrou novo login para ${newUser.name} (${newUser.email} -> ${newUser.role})` });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao cadastrar novo usuário.' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, role, name } = body;
    if (!id) return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(role ? { role: role === 'ADMIN' ? 'ADMIN' : 'USER' } : {}),
        ...(name ? { name: name.trim() } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    await logAction({ actionType: 'ATUALIZAR', module: 'USUARIOS', description: `Atualizou permissões do usuário ${updated.name} (${updated.email} -> ${updated.role})` });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar usuário.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    // Verificar se o usuário a ser excluído é a conta master ou a conta solicitada
    const userToDelete = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (userToDelete.email === 'admin@solyd3d.com') {
      return NextResponse.json({ error: 'O usuário administrador principal (admin@solyd3d.com) não pode ser removido.' }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id },
    });

    await logAction({ actionType: 'EXCLUIR', module: 'USUARIOS', description: `Excluiu o login de ${userToDelete.name} (${userToDelete.email})` });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao remover usuário.' }, { status: 500 });
  }
}
