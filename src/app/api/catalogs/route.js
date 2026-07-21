import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Utilitário para gerar o slug do catálogo
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

export async function GET() {
  try {
    const catalogs = await prisma.catalog.findMany({
      include: {
        items: {
          include: {
            product: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(catalogs);
  } catch (error) {
    console.error("Erro ao buscar catálogos:", error);
    return NextResponse.json({ error: 'Erro ao buscar catálogos' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, productIds } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    // Garante um slug único
    let slug = generateSlug(name);
    const existing = await prisma.catalog.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const catalog = await prisma.catalog.create({
      data: {
        name,
        slug,
        items: {
          create: (productIds || []).map(productId => ({
            product: { connect: { id: productId } }
          }))
        }
      },
      include: { items: true }
    });

    return NextResponse.json(catalog, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar catálogo:", error);
    return NextResponse.json({ error: 'Erro ao criar catálogo' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, name, productIds } = await request.json();

    if (!id || !name) {
      return NextResponse.json({ error: 'ID e Nome são obrigatórios' }, { status: 400 });
    }

    // Gerar um novo slug (opcional, pode manter o antigo se preferir)
    let slug = generateSlug(name);
    const existing = await prisma.catalog.findFirst({
      where: { slug, id: { not: id } }
    });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Primeiro, atualiza o nome e slug do catálogo, e limpa os itens antigos
    // e depois recria. O Prisma permite update com set ou deleteMany/create
    const catalog = await prisma.catalog.update({
      where: { id },
      data: {
        name,
        slug,
        items: {
          deleteMany: {}, // Apaga as referências antigas (CatalogItem)
          create: (productIds || []).map(productId => ({
            product: { connect: { id: productId } }
          }))
        }
      },
      include: { items: true }
    });

    return NextResponse.json(catalog);
  } catch (error) {
    console.error("Erro ao atualizar catálogo:", error);
    return NextResponse.json({ error: 'Erro ao atualizar catálogo' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID ausente' }, { status: 400 });
    }

    await prisma.catalog.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir catálogo:", error);
    return NextResponse.json({ error: 'Erro ao excluir catálogo' }, { status: 500 });
  }
}
