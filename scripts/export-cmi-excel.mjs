/**
 * One-time / maintenance: converts Sample Framework CMI.xlsx proposition sheets to public JSON.
 * Run: node scripts/export-cmi-excel.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const XLSX_PATH = path.join(
  ROOT,
  'Sample Framework_Customer Database_Global Compliance As A Service Market_CMI.xlsx'
)
const OUT = path.join(ROOT, 'public', 'data', 'customer-intelligence-cmi.json')

const SHEETS = [
  { sheetName: 'Proposition 1 - Basic', label: 'Proposition 1 — Basic' },
  { sheetName: 'Proposition 2 - Advance', label: 'Proposition 2 — Advance' },
  { sheetName: 'Proposition 3 - Premium', label: 'Proposition 3 — Premium' }
]

const HEADER_FIRST_ROW = 4 // 0-based (Excel row 5)
const BODY_START_ROW = 6 // 0-based — data rows after header pair

function cellText(v) {
  if (v == null || v === undefined) return ''
  return String(v).replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim()
}

/** Proposition 1 is Basic only: Customer Information + Contact Details (exclude Professional Drivers). */
const PROP1_COLUMN_END = 11 // inclusive last column index (S.No. + 5 CI + 6 Contact = 12 columns, indices 0–11)

function truncatePropositionOne(headerRows, body, merges) {
  const end = PROP1_COLUMN_END + 1
  const hdr = headerRows.map((row) => row.slice(0, end))
  const bod = body.map((row) => row.slice(0, end))
  const hdrMerges = merges.filter((m) => m.e.c <= PROP1_COLUMN_END && m.s.c <= PROP1_COLUMN_END)
  return { headerRows: hdr, body: bod, headerMerges: hdrMerges }
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error('Missing file:', XLSX_PATH)
    process.exit(1)
  }

  const wb = XLSX.readFile(XLSX_PATH)
  const out = {
    meta: {
      title: 'Global Compliance As A Service Market — Customer Database',
      subtitle: 'Verified directory and insight on customers',
      source: path.basename(XLSX_PATH)
    },
    propositions: []
  }

  for (let i = 0; i < SHEETS.length; i++) {
    const { sheetName, label } = SHEETS[i]
    const sh = wb.Sheets[sheetName]
    if (!sh) {
      console.warn('Skip missing sheet:', sheetName)
      continue
    }

    const raw = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false })
    const maxCol = raw.reduce((m, row) => Math.max(m, row?.length || 0), 0)

    const padRow = (r) => {
      const rr = [...(r || [])]
      while (rr.length < maxCol) rr.push('')
      return rr.map(cellText)
    }

    let headerRows = [
      padRow(raw[HEADER_FIRST_ROW] || []),
      padRow(raw[HEADER_FIRST_ROW + 1] || [])
    ]

    let body = []
    for (let r = BODY_START_ROW; r < raw.length; r++) {
      const row = padRow(raw[r] || [])
      if (row.every((x) => x === '')) continue
      body.push(row)
    }

    let merges = []
    const allMerges = sh['!merges'] || []
    for (const m of allMerges) {
      const { s, e } = m
      if (s.r < HEADER_FIRST_ROW || e.r > HEADER_FIRST_ROW + 1) continue
      merges.push({
        s: { r: s.r - HEADER_FIRST_ROW, c: s.c },
        e: { r: e.r - HEADER_FIRST_ROW, c: e.c }
      })
    }

    if (sheetName === 'Proposition 1 - Basic') {
      ;({ headerRows, body, headerMerges: merges } = truncatePropositionOne(headerRows, body, merges))
    }

    out.propositions.push({
      id: i + 1,
      label,
      sheetName,
      headerMerges: merges,
      headerRows,
      body
    })
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')
  console.log('Wrote', OUT, '—', out.propositions.length, 'propositions')
}

main()
