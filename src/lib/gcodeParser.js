/**
 * Utilitário de parsing ultrarrápido de arquivos .Gcode no navegador (in-memory)
 * Extrai estimativas de tempo, peso (g) e tipo de material de comentários de fatiadores
 * (Bambu Studio, OrcaSlicer, PrusaSlicer, SuperSlicer, Cura, Simplify3D)
 */

export async function parseGcodeFile(file) {
  if (!file) return null;

  // Limpar nome do arquivo (sem extensão)
  const cleanName = file.name
    .replace(/\.gcode(\.gz)?$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  try {
    // Ler os primeiros 150 KB e os últimos 150 KB (onde ficam os cabeçalhos/rodapés com metadados)
    const chunkSize = 150 * 1024; // 150 KB
    const headerSlice = file.slice(0, Math.min(file.size, chunkSize));
    const footerSlice = file.slice(Math.max(0, file.size - chunkSize), file.size);

    const [headerText, footerText] = await Promise.all([
      headerSlice.text(),
      footerSlice.text(),
    ]);

    const content = headerText + '\n' + footerText;

    // 1. EXTRAÇÃO DO TEMPO DE IMPRESSÃO (MINUTOS)
    let minutes = 0;

    // Padrão Cura: "; TIME:6543" (em segundos)
    const curaTimeMatch = content.match(/;\s*TIME\s*[:=]\s*(\d+)/i);
    if (curaTimeMatch && curaTimeMatch[1]) {
      const seconds = Number(curaTimeMatch[1]);
      minutes = Math.round(seconds / 60);
    } else {
      // Padrão Bambu Studio / OrcaSlicer / PrusaSlicer:
      // "; estimated printing time (normal mode) = 2h 45m 12s" ou "1h 30m" ou "45m 12s"
      const timeRegex = /estimated.*?time.*?[:=]\s*(?:(\d+)\s*d\s*)?(?:(\d+)\s*h\s*)?(?:(\d+)\s*m\s*)?(?:(\d+)\s*s)?/i;
      const timeMatch = content.match(timeRegex);

      if (timeMatch) {
        const days = Number(timeMatch[1]) || 0;
        const hours = Number(timeMatch[2]) || 0;
        const mins = Number(timeMatch[3]) || 0;
        const secs = Number(timeMatch[4]) || 0;

        minutes = (days * 24 * 60) + (hours * 60) + mins + Math.round(secs / 60);
      } else {
        // Tentar tempo apenas em segundos (ex: "; estimated printing time = 1234 s")
        const secMatch = content.match(/estimated.*?time.*?[:=]\s*(\d+)\s*s\b/i);
        if (secMatch && secMatch[1]) {
          minutes = Math.round(Number(secMatch[1]) / 60);
        }
      }
    }

    // 2. EXTRAÇÃO DO PESO EM GRAMAS
    let weightG = 0;

    // Padrão Bambu Studio / OrcaSlicer / PrusaSlicer: "; total filament used [g] = 45.23" ou "; filament used [g] = 45.23"
    const filamentGMatch = content.match(/filament.*?(?:used|weight).*?\[g\]\s*[:=]\s*([\d.]+)/i) ||
                           content.match(/total\s*filament\s*used\s*\[g\]\s*[:=]\s*([\d.]+)/i);

    if (filamentGMatch && filamentGMatch[1]) {
      weightG = Number(filamentGMatch[1]);
    } else {
      // Padrão Cura / Simplify3D: "; Filament weight = 37.12" ou "; Weight: 37.12g"
      const weightMatch = content.match(/;\s*(?:Filament\s*)?weight\s*[:=]\s*([\d.]+)\s*g?/i) ||
                          content.match(/,\s*([\d.]+)\s*g\s*$/im);
      if (weightMatch && weightMatch[1]) {
        weightG = Number(weightMatch[1]);
      }
    }

    // 3. EXTRAÇÃO DO TIPO DE MATERIAL
    let material = 'PLA';
    const materialMatch = content.match(/filament_?type\s*[:=]\s*([A-Z0-9,\s\[\]-]+)/i);
    if (materialMatch && materialMatch[1]) {
      // Limpar parênteses ou colchetes se for array (ex: "[PLA, PETG]" -> "PLA")
      const rawMat = materialMatch[1].replace(/[[\]'"]/g, '').split(',')[0].trim();
      if (rawMat) material = rawMat.toUpperCase();
    }

    return {
      name: cleanName || 'Chapa G-Code',
      estimatedWeightG: weightG > 0 ? Number(weightG.toFixed(2)) : 50,
      estimatedPrintMinutes: minutes > 0 ? Math.max(1, minutes) : 60,
      materialColorNeeded: material,
      yieldPerCycle: 1,
    };
  } catch (error) {
    console.error('Erro ao processar G-code em memória:', error);
    return {
      name: cleanName || 'Chapa G-Code',
      estimatedWeightG: 50,
      estimatedPrintMinutes: 60,
      materialColorNeeded: 'PLA',
      yieldPerCycle: 1,
    };
  }
}
