/**
 * Solyd3D — Formatadores de Dados (PT-BR)
 */

/**
 * Formata um valor em Reais (BRL)
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

/**
 * Formata peso em gramas
 * @param {number} grams
 * @returns {string}
 */
export function formatWeight(grams) {
  if (grams === null || grams === undefined) return '0g';
  return `${Number(grams).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}g`;
}

/**
 * Formata tempo em minutos para horas e minutos
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (!minutes) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Formata uma data para o padrão brasileiro
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Formata uma data com hora
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Formata porcentagem
 * @param {number} value
 * @returns {string}
 */
export function formatPercent(value) {
  if (value === null || value === undefined) return '0%';
  return `${Number(value).toFixed(1)}%`;
}

/**
 * Labels para status de produção
 */
export const orderStatusLabels = {
  QUEUED: 'Na Fila',
  SLICED: 'Fatiado',
  PRINTING: 'Imprimindo',
  POST_PROCESSING: 'Pós-Processamento',
  COMPLETED: 'Concluído',
  FAILED: 'Falha / Scrap',
};

/**
 * Labels para status de filamento
 */
export const filamentStatusLabels = {
  AVAILABLE: 'Disponível',
  LOW: 'Estoque Baixo',
  EMPTY: 'Vazio',
  RESERVED: 'Reservado',
};

/**
 * Labels para status de máquina
 */
export const machineStatusLabels = {
  ACTIVE: 'Ativa',
  MAINTENANCE: 'Manutenção',
  INACTIVE: 'Inativa',
};

/**
 * Labels para roles de usuário
 */
export const roleLabels = {
  ADMIN: 'Administrador',
  USER: 'Usuário',
  PENDING: 'Pendente',
};

/**
 * Labels para categorias de despesas
 */
export const expenseCategoryLabels = {
  INSTALLMENT: 'Parcela',
  DEPRECIATION: 'Depreciação',
  RENT: 'Aluguel',
  FILAMENT: 'Filamento',
  NOZZLE: 'Bico',
  RESIN: 'Resina',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outros',
};

/**
 * Labels para métodos de pagamento
 */
export const paymentMethodLabels = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  CARD: 'Cartão',
  TRANSFER: 'Transferência',
};
