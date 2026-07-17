import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logAction } from '@/lib/activityLogger';

// Configurações padrão do sistema
const DEFAULT_CONFIGS = [
  {
    key: 'modo_estoque_granular',
    value: 'false',
    label: 'Estoque Granular (Controle por Gramas)',
  },
];

// GET - Retorna todas as configurações do sistema
export async function GET() {
  try {
    // Garantir que as configs padrão existem
    for (const cfg of DEFAULT_CONFIGS) {
      await prisma.systemConfig.upsert({
        where: { key: cfg.key },
        create: cfg,
        update: {},
      });
    }

    const configs = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Converter para objeto chave-valor para facilitar o consumo no frontend
    const configMap = {};
    for (const c of configs) {
      configMap[c.key] = {
        value: c.value,
        label: c.label,
      };
    }

    return NextResponse.json(configMap);
  } catch (error) {
    console.error('GET /api/system-config error:', error);
    return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 });
  }
}

// PUT - Atualizar uma configuração
export async function PUT(request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Campos key e value são obrigatórios' }, { status: 400 });
    }

    const config = await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });

    const label = key === 'modo_estoque_granular'
      ? (value === 'true' ? 'LIGADO (Granular — Subtrai gramas)' : 'DESLIGADO (Simplificado — Ativo/Inativo)')
      : String(value);

    await logAction({
      actionType: 'ATUALIZAR',
      module: 'CONFIGURACOES',
      description: `Alterou configuração "${key}" para: ${label}`,
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('PUT /api/system-config error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar configuração' }, { status: 500 });
  }
}
