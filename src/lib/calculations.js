/**
 * Solyd3D — Funções de Cálculo de Custeio
 * Todas as funções de negócio centralizadas aqui
 */

/**
 * Calcula o custo por grama de um rolo de filamento
 * @param {number} costPerRoll - Custo total do rolo em R$
 * @param {number} initialWeightG - Peso inicial do rolo em gramas
 * @returns {number} Custo por grama
 */
export function calculateCostPerGram(costPerRoll, initialWeightG) {
  if (initialWeightG <= 0) return 0;
  return Number((costPerRoll / initialWeightG).toFixed(4));
}

/**
 * Calcula o custo de material de uma produção
 * @param {number} weightG - Peso em gramas utilizado
 * @param {number} costPerGram - Custo por grama do filamento
 * @returns {number} Custo do material
 */
export function calculateMaterialCost(weightG, costPerGram) {
  return Number((weightG * costPerGram).toFixed(2));
}

/**
 * Calcula o custo de energia de uma impressão
 * @param {number} powerWatts - Potência da máquina em watts
 * @param {number} printMinutes - Tempo de impressão em minutos
 * @param {number} kwhPrice - Preço do kWh em R$
 * @returns {number} Custo de energia em R$
 */
export function calculateEnergyCost(powerWatts, printMinutes, kwhPrice) {
  const kw = powerWatts / 1000;
  const hours = printMinutes / 60;
  return Number((kw * hours * kwhPrice).toFixed(2));
}

/**
 * Calcula o custo total de uma produção
 * @param {number} materialCost - Custo do material
 * @param {number} energyCost - Custo de energia
 * @returns {number} Custo total
 */
export function calculateTotalCost(materialCost, energyCost) {
  return Number((materialCost + energyCost).toFixed(2));
}

/**
 * Calcula o preço de venda sugerido
 * @param {number} totalCost - Custo total de produção
 * @param {number} profitMarginPct - Margem de lucro em percentual
 * @returns {number} Preço de venda sugerido
 */
export function calculateSuggestedPrice(totalCost, profitMarginPct) {
  return Number((totalCost * (1 + profitMarginPct / 100)).toFixed(2));
}

/**
 * Calcula o custo de depreciação por hora de uso
 * @param {number} purchasePrice - Preço de compra da máquina
 * @param {number} usefulLifeHours - Vida útil estimada em horas (default: 5000h)
 * @returns {number} Custo de depreciação por hora
 */
export function calculateDepreciationPerHour(purchasePrice, usefulLifeHours = 5000) {
  if (usefulLifeHours <= 0) return 0;
  return Number((purchasePrice / usefulLifeHours).toFixed(4));
}

/**
 * Determina o status do filamento baseado no peso restante
 * @param {number} remainingWeightG - Peso restante em gramas
 * @param {number} lowThreshold - Limiar de estoque baixo (default: 200g)
 * @returns {string} Status do filamento
 */
export function determineFilamentStatus(remainingWeightG, lowThreshold = 200) {
  if (remainingWeightG <= 0) return 'EMPTY';
  if (remainingWeightG < lowThreshold) return 'LOW';
  return 'AVAILABLE';
}
