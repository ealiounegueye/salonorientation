import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Participant, StatutParticipant } from '../types'
import { evenement } from './evenement'
import { formatQuand, filtreRecherche, libelleDates, libelleProfil, LIBELLE_STATUT } from './format'
import type { StatsSalon } from './stats'
import { supabase } from './supabase'

const ENTETES = [
  'Code',
  'Prénom',
  'Nom',
  'Âge',
  'E-mail',
  'Téléphone',
  'Profil',
  'Dates',
  'Organisation',
  'Fonction',
  'Statut',
  'Inscrit le',
] as const

export type FiltresExport = {
  statut?: 'tous' | StatutParticipant
  profil?: string
  jour?: string
  recherche?: string
}

function suffixeFichier() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Dakar' }).format(new Date())
}

function lignesTableau(participants: Participant[]) {
  return participants.map((ligne) => [
    ligne.code,
    ligne.prenom,
    ligne.nom,
    ligne.age ?? '',
    ligne.email,
    ligne.telephone ?? '',
    libelleProfil(ligne.profil),
    libelleDates(ligne.dates),
    ligne.organisation ?? '',
    ligne.fonction ?? '',
    LIBELLE_STATUT[ligne.statut],
    formatQuand(ligne.created_at),
  ])
}

export async function chargerParticipants(filtres?: FiltresExport): Promise<Participant[]> {
  const toutes: Participant[] = []
  const filtreTexte = filtres?.recherche ? filtreRecherche(filtres.recherche) : null
  for (let from = 0; from < 20000; from += 1000) {
    let requete = supabase.from('participants').select('*').order('created_at', { ascending: false })
    if (filtres?.statut && filtres.statut !== 'tous') requete = requete.eq('statut', filtres.statut)
    if (filtres?.profil && filtres.profil !== 'tous') requete = requete.eq('profil', filtres.profil)
    if (filtres?.jour && filtres.jour !== 'toutes') requete = requete.contains('jours_sel', [filtres.jour])
    if (filtreTexte) requete = requete.or(filtreTexte)
    const { data, error } = await requete.range(from, from + 999)
    if (error || !data?.length) break
    toutes.push(...(data as Participant[]))
    if (data.length < 1000) break
  }
  return toutes
}

export function exporterCsv(participants: Participant[]) {
  const corps = lignesTableau(participants).map((ligne) =>
    ligne.map((valeur) => `"${String(valeur).replaceAll('"', '""')}"`).join(';'),
  )
  const blob = new Blob([`\uFEFF${[ENTETES.join(';'), ...corps].join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `participants-salon-${suffixeFichier()}.csv`
  lien.click()
  URL.revokeObjectURL(url)
}

export function exporterExcel(participants: Participant[]) {
  const feuille = XLSX.utils.aoa_to_sheet([[...ENTETES], ...lignesTableau(participants)])
  feuille['!cols'] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 6 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
  ]
  const classeur = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(classeur, feuille, 'Participants')
  XLSX.writeFile(classeur, `participants-salon-${suffixeFichier()}.xlsx`)
}

export function exporterPdf(participants: Participant[], stats?: StatsSalon) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFontSize(16)
  doc.setTextColor(224, 0, 26)
  doc.text(evenement.titre, 14, 14)
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Export du ${formatQuand(new Date().toISOString())} — ${participants.length} ligne(s)`, 14, 20)

  let y = 26
  if (stats) {
    doc.setFontSize(9)
    doc.text(
      `Inscriptions : ${stats.actifs}  ·  Présents : ${stats.presents}  ·  Taux de présence : ${stats.tauxPresence}%  ·  Aujourd’hui : ${stats.inscriptionsAujourdhui}`,
      14,
      y,
    )
    y += 6
    if (stats.ageMoyen != null) {
      doc.text(`Âge moyen : ${stats.ageMoyen} ans`, 14, y)
      y += 6
    }
  }

  autoTable(doc, {
    head: [ENTETES as unknown as string[]],
    body: lignesTableau(participants).map((ligne) => ligne.map(String)),
    startY: y + 2,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [224, 0, 26], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [252, 248, 248] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`participants-salon-${suffixeFichier()}.pdf`)
}
