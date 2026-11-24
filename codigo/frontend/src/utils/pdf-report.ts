import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type GameState, objectiveWords } from '../domain/game';
import { POLICY_LABELS, type PolicyId, estimateProfile } from '../domain/policy';
import { market } from '../data/market';

const ACTION_LABELS: Record<string, string> = {
  a0: '-',
  a1: 'Pista de categoria',
  a2: 'Elimino distractor',
  a3: 'Senalo producto',
  a4: 'Repitio indicacion',
};

const PROFILE_LABELS = ['Rapido / Autonomo', 'Ritmo medio', 'Necesita apoyo continuo'];
const PROFILE_COLORS: [number, number, number][] = [
  [40, 122, 52],
  [65, 100, 170],
  [180, 60, 40],
];

function sectionHeader(
  doc: jsPDF,
  title: string,
  ml: number,
  cw: number,
  y: number,
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(75, 35, 118);
  doc.text(title, ml, y);
  doc.setDrawColor(75, 35, 118);
  doc.setLineWidth(0.4);
  doc.line(ml, y + 1.5, ml + cw, y + 1.5);
}

export function downloadSessionReport(state: GameState, policy: PolicyId): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const data = market;
  const challenge = data.retos[state.reto_idx];
  const now = new Date();
  const log = state.log_eventos;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ML = 18;
  const MR = 18;
  const CW = pageW - ML - MR;

  const totalProducts = challenge.lista_correcta.length;
  const boughtProducts = state.items_en_carrito.length;
  const meanMs = log.length
    ? log.reduce((s, e) => s + e.t_ms, 0) / log.length
    : 0;
  const profileIndex = estimateProfile(state.errores_totales, boughtProducts, meanMs);
  const durationS = (log.reduce((s, e) => s + e.t_ms, 0) / 1000).toFixed(0);
  const dateStr = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // ——— CABECERA ———
  doc.setFillColor(75, 35, 118);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setFillColor(112, 65, 149);
  doc.rect(0, 24, pageW, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PictoMarket', ML, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Informe de Sesion Terapeutica', ML, 23);
  doc.text(`${dateStr}  |  ${timeStr}`, pageW - MR, 23, { align: 'right' });

  // Resultado sesion en banda inferior de la cabecera
  const sessionComplete = boughtProducts === totalProducts;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    sessionComplete
      ? 'SESION COMPLETADA'
      : `EN PROGRESO: ${boughtProducts}/${totalProducts} productos`,
    ML,
    29.5,
  );

  let y = 42;

  // ——— DATOS DE LA SESION ———
  sectionHeader(doc, 'Datos de la sesion', ML, CW, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    body: [
      [
        'Escenario',
        `${challenge.id_reto.replace(/_/g, ' ')}  -  Nivel ${challenge.nivel}`,
      ],
      ['Objetivo', objectiveWords(challenge).join(' / ').toLowerCase()],
      ['Politica de ayuda', POLICY_LABELS[policy]],
      [
        'Duracion estimada',
        `${durationS} segundos  (${log.length} interacciones)`,
      ],
    ],
    styles: { fontSize: 10, cellPadding: 3.5 },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        fillColor: [241, 232, 249],
        cellWidth: 52,
        textColor: [75, 45, 110],
      },
      1: { fillColor: [253, 249, 245] },
    },
    theme: 'grid',
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ——— RESUMEN DE RENDIMIENTO ———
  sectionHeader(doc, 'Resumen de rendimiento', ML, CW, y);
  y += 6;

  const statW = (CW - 9) / 4;
  const statItems = [
    {
      label: 'Productos\ncomprados',
      value: `${boughtProducts}/${totalProducts}`,
    },
    { label: 'Errores\ntotales', value: String(state.errores_totales) },
    { label: 'Nivel de pista\nmaximo', value: `${state.nivel_pista}/3` },
    { label: 'Presupuesto\nrestante', value: `${state.monedas} mon.` },
  ];

  statItems.forEach((stat, i) => {
    const x = ML + i * (statW + 3);
    doc.setFillColor(241, 232, 249);
    doc.roundedRect(x, y, statW, 25, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(112, 65, 149);
    doc.text(stat.value, x + statW / 2, y + 11, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 80, 125);
    stat.label.split('\n').forEach((line, li) => {
      doc.text(line, x + statW / 2, y + 17 + li * 4.5, { align: 'center' });
    });
  });

  y += 32;

  // Perfil estimado
  const pc = PROFILE_COLORS[profileIndex];
  const profileText = `Perfil estimado: ${PROFILE_LABELS[profileIndex]}`;
  doc.setFillColor(pc[0], pc[1], pc[2]);
  const badgeW = doc.getTextWidth(profileText) + 14;
  doc.roundedRect(ML, y - 5.5, badgeW, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(profileText, ML + 7, y);

  y += 12;

  // ——— REGISTRO DE EVENTOS ———
  sectionHeader(doc, `Registro de eventos (${log.length})`, ML, CW, y);
  y += 4;

  if (log.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      head: [['#', 'Tiempo', 'Objetivo', 'Tocado', 'Resultado', 'Accion del agente']],
      body: log.map((e, idx) => [
        String(idx + 1),
        `${(e.t_ms / 1000).toFixed(1)}s`,
        (data.catalogo[e.item_objetivo]?.nombre ?? String(e.item_objetivo)).toLowerCase(),
        (data.catalogo[e.item_tocado]?.nombre ?? String(e.item_tocado)).toLowerCase(),
        e.correcto ? 'Correcto' : 'Error',
        ACTION_LABELS[e.accion_agente] ?? e.accion_agente,
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: {
        fillColor: [75, 35, 118],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 244, 255] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 22, fontStyle: 'bold' },
      },
      didParseCell: (hookData) => {
        if (hookData.column.index === 4 && hookData.section === 'body') {
          hookData.cell.styles.textColor =
            String(hookData.cell.raw) === 'Correcto'
              ? [30, 110, 45]
              : [170, 40, 20];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(150, 140, 165);
    doc.text('No se registraron eventos en esta sesion.', ML, y + 6);
    y += 18;
  }

  // ——— NOTAS DEL TERAPEUTA ———
  if (y + 55 > pageH - 20) {
    doc.addPage();
    y = 20;
  }

  sectionHeader(doc, 'Notas del terapeuta', ML, CW, y);
  y += 10;

  doc.setDrawColor(200, 185, 220);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 6; i++) {
    doc.line(ML, y + i * 10, ML + CW, y + i * 10);
  }

  // ——— PIE DE PAGINA ———
  const footerY = pageH - 10;
  doc.setDrawColor(200, 185, 220);
  doc.setLineWidth(0.3);
  doc.line(ML, footerY - 5, ML + CW, footerY - 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 150, 175);
  doc.text(
    'PictoMarket - Herramienta de comunicacion aumentativa y alternativa - Kallpa Asociacion',
    pageW / 2,
    footerY,
    { align: 'center' },
  );

  const dateFileStr = now.toISOString().slice(0, 10);
  doc.save(`pictomarket-${challenge.id_reto}-${dateFileStr}.pdf`);
}
