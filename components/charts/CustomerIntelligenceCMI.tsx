'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type HeaderMerge = { s: { r: number; c: number }; e: { r: number; c: number } }

export type CmiProposition = {
  id: number
  label: string
  sheetName: string
  headerMerges: HeaderMerge[]
  headerRows: string[][]
  body: (string | number)[][]
}

type CmiPayload = {
  meta: { title: string; subtitle: string; source: string }
  propositions: CmiProposition[]
}

/** Column floor: avoids squeezed headers (fixed layout + equal % was causing overlap). */
const CMI_FIRST_COL_MIN_PX = 52
const CMI_DATA_COL_MIN_PX = 288 /* 18rem — fits long labels e.g. Phone/WhatsApp */

/** Excel-style: short label + optional parenthetical detail (full text preserved). */
function splitHeaderLabel(raw: string): { title: string; detail: string | null } {
  const t = raw.replace(/\r\n/g, ' ').replace(/\n/g, ' ').trim()
  if (!t) return { title: '', detail: null }
  const open = t.indexOf('(')
  if (open === -1) return { title: t, detail: null }
  const title = t.slice(0, open).trim()
  const detail = t.slice(open).trim()
  if (!title) return { title: t, detail: null }
  return { title, detail }
}

function HeaderCellBody({ text, variant }: { text: string; variant: 'group' | 'sub' }) {
  const { title, detail } = splitHeaderLabel(text)
  const weight = variant === 'group' ? 'font-bold' : 'font-semibold'

  if (!detail) {
    return <span className={`text-xs ${weight} text-gray-900`}>{title || text}</span>
  }

  return (
    <p className={`text-xs leading-relaxed text-gray-900 break-words ${weight}`}>
      {title}
      <span className="font-normal text-gray-800"> {detail}</span>
    </p>
  )
}

/** Top-row band label per column (from row-0 merge covering that column). */
function columnBandLabels(headerRows: string[][], headerMerges: HeaderMerge[], w: number): string[] {
  const bands: string[] = Array(w).fill('')
  for (let c = 0; c < w; c++) {
    const m = headerMerges.find((mer) => mer.s.r === 0 && mer.s.c <= c && mer.e.c >= c)
    if (!m) continue
    const raw = (headerRows[m.s.r]?.[m.s.c] ?? '').trim()
    bands[c] = raw
  }
  return bands
}

function bodyCellClassForBand(band: string): string {
  const b = band.toLowerCase()
  if (band === 'S.No.' || band === '') return 'bg-[#F3F4F6]'
  if (b.includes('customer information')) return 'bg-[#FCEFF1]'
  if (b.includes('contact details')) return 'bg-[#E3F2FD]'
  if (b.includes('professional drivers')) return 'bg-[#EBF3FB]'
  if (b.includes('purchasing')) return 'bg-[#E4EDF8]'
  if (b.includes('solution requirements')) return 'bg-[#E8F0FA]'
  if (b.includes('cmi insight')) return 'bg-[#E6EBF2]'
  return 'bg-[#F4F8FC]'
}

function normSection(s: string): string {
  return s.trim().toLowerCase()
}

/** Row-0 section band (distinct colors per major block). */
function groupHeaderSectionClass(label: string): string {
  const s = normSection(label)
  if (!label || label === 'S.No.') return 'bg-[#E8EBF0]'
  if (s.includes('customer information')) return 'bg-[#F8D7E4]'
  if (s.includes('contact details')) return 'bg-[#BFDBFE]'
  if (s.includes('professional drivers')) return 'bg-[#FDE68A]'
  if (s.includes('purchasing')) return 'bg-[#C7D2FE]'
  if (s.includes('solution requirements')) return 'bg-[#A7F3D0]'
  if (s.includes('cmi insight')) return 'bg-[#E9D5FF]'
  return 'bg-[#FFF8DC]'
}

/** Second header row: lighter companion tint per section column. */
function subHeaderSectionClass(band: string): string {
  const s = normSection(band)
  if (band === 'S.No.' || band === '') return 'bg-[#ECEFF2]'
  if (s.includes('customer information')) return 'bg-[#FCE4EC]'
  if (s.includes('contact details')) return 'bg-[#DDEBF7]'
  if (s.includes('professional drivers')) return 'bg-[#FEF9C3]'
  if (s.includes('purchasing')) return 'bg-[#E0E7FF]'
  if (s.includes('solution requirements')) return 'bg-[#D1FAE5]'
  if (s.includes('cmi insight')) return 'bg-[#EDE9FE]'
  return 'bg-[#DDEBF7]'
}

function mergedGroupCellClass(p: { startC: number; rowSpan: number; text: string }): string {
  if (p.rowSpan >= 2 && p.startC === 0) return 'bg-[#E8EBF0]'
  return groupHeaderSectionClass(p.text)
}

function MergedTableHeader({
  headerRows,
  headerMerges
}: {
  headerRows: string[][]
  headerMerges: HeaderMerge[]
}) {
  const h = headerRows.length
  const w = Math.max(...headerRows.map((r) => r.length), 0)
  if (h === 0 || w === 0) return null

  const colBand = columnBandLabels(headerRows, headerMerges, w)

  const occ: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false))
  const placed: {
    key: string
    tr: number
    startC: number
    text: string
    rowSpan: number
    colSpan: number
  }[] = []

  const sorted = [...headerMerges].sort((a, b) => a.s.r - b.s.r || a.s.c - b.s.c)

  for (const m of sorted) {
    const rs = m.s.r
    const cs = m.s.c
    const re = m.e.r
    const ce = m.e.c
    if (rs < 0 || rs >= h || cs < 0) continue
    const text = (headerRows[rs]?.[cs] ?? '').trim()
    const rowSpan = re - rs + 1
    const colSpan = ce - cs + 1
    for (let r = rs; r <= re && r < h; r++) {
      for (let c = cs; c <= ce && c < w; c++) {
        occ[r][c] = true
      }
    }
    placed.push({ key: `${rs}-${cs}`, tr: rs, startC: cs, text, rowSpan, colSpan })
  }

  const rows: ReactNode[] = []
  for (let tr = 0; tr < h; tr++) {
    const cells: ReactNode[] = []
    let c = 0
    while (c < w) {
      if (occ[tr][c]) {
        const p = placed.find((m) => m.tr === tr && m.startC === c)
        if (p) {
          const stickyFirst =
            p.startC === 0 ? 'sticky left-0 z-[38] border-r border-r-slate-400/45 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)]' : ''
          cells.push(
            <th
              key={`m-${tr}-${c}`}
              rowSpan={p.rowSpan}
              colSpan={p.colSpan}
              className={`border border-[#CBD5E1] px-3 py-2 text-left align-top ${mergedGroupCellClass(p)} ${stickyFirst}`}
            >
              <HeaderCellBody text={p.text || '\u00A0'} variant="group" />
            </th>
          )
          c += p.colSpan
          continue
        }
        c++
        continue
      }
      const val = (headerRows[tr]?.[c] ?? '').trim()
      const stickyFirst = c === 0 ? 'sticky left-0 z-[38] border-r border-r-slate-400/45 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)]' : ''
      cells.push(
        <th
          key={`u-${tr}-${c}`}
          className={`border border-[#CBD5E1] px-3 py-2 text-left align-top ${subHeaderSectionClass(colBand[c] ?? '')} ${stickyFirst}`}
        >
          <HeaderCellBody text={val} variant="sub" />
        </th>
      )
      c++
    }
    rows.push(<tr key={`hr-${tr}`}>{cells}</tr>)
  }

  return <>{rows}</>
}

function CmiTable({ prop }: { prop: CmiProposition }) {
  const w = Math.max(...prop.headerRows.map((r) => r.length), 0)
  const bands = columnBandLabels(prop.headerRows, prop.headerMerges, w)
  const tableMinPx =
    w <= 1 ? CMI_FIRST_COL_MIN_PX : CMI_FIRST_COL_MIN_PX + (w - 1) * CMI_DATA_COL_MIN_PX

  return (
    <div>
      <p className="text-xs text-gray-600 mb-2 px-1 leading-snug">
        On smaller screens, scroll sideways—the table is wide so headers do not overlap. The first column stays visible.
      </p>
      <div className="rounded-md border border-gray-200 bg-white overflow-x-auto shadow-sm">
        <table className="w-full border-collapse text-sm" style={{ minWidth: tableMinPx }}>
          <colgroup>
            {w >= 1 && (
              <col
                span={1}
                style={{
                  width: CMI_FIRST_COL_MIN_PX,
                  minWidth: CMI_FIRST_COL_MIN_PX
                }}
              />
            )}
            {Array.from({ length: Math.max(0, w - 1) }, (_, i) => (
              <col key={`d-${i}`} style={{ minWidth: CMI_DATA_COL_MIN_PX }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgb(203,213,225)]">
            <MergedTableHeader headerRows={prop.headerRows} headerMerges={prop.headerMerges} />
          </thead>
          <tbody>
            {prop.body.map((row, ri) => (
              <tr key={ri} className="hover:bg-black/[0.02]">
                {row.map((cell, ci) => {
                  const stickyFirst =
                    ci === 0
                      ? 'sticky left-0 z-[18] border-r border-r-slate-400/45 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.1)]'
                      : ''
                  return (
                    <td
                      key={ci}
                      className={`border border-[#CBD5E1] px-3 py-1.5 text-xs text-black align-top whitespace-normal break-words ${bodyCellClassForBand(bands[ci] ?? '')} ${stickyFirst}`}
                    >
                      {cell === null || cell === undefined ? '' : String(cell)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PropositionAccordion({
  title,
  defaultOpen,
  children
}: {
  title: string
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left border-b border-transparent"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-black">{title}</span>
        {open ? <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" aria-hidden /> : <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" aria-hidden />}
      </button>
      {open && (
        <div className="px-2 pb-4 bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

export function CustomerIntelligenceCMI() {
  const [payload, setPayload] = useState<CmiPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/data/customer-intelligence-cmi.json', { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to load CMI data (${res.status})`)
        const data = (await res.json()) as CmiPayload
        if (!cancelled) setPayload(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load data')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-black">
        <p className="font-medium">Customer Intelligence data could not be loaded.</p>
        <p className="mt-1 text-black">{error}</p>
        <p className="mt-2 text-xs text-gray-600">
          Run <code className="bg-white px-1 rounded">node scripts/export-cmi-excel.mjs</code> after updating the sample Excel file.
        </p>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="flex items-center justify-center h-40 text-black text-sm">Loading customer intelligence…</div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-black">{payload.meta.title}</h2>
        <p className="text-sm text-gray-700 mt-1">{payload.meta.subtitle}</p>
        <p className="text-xs text-gray-500 mt-1">Source: {payload.meta.source}</p>
      </div>

      {payload.propositions.map((prop, idx) => (
        <PropositionAccordion key={prop.id} title={prop.label} defaultOpen={idx === 0}>
          <CmiTable prop={prop} />
        </PropositionAccordion>
      ))}
    </div>
  )
}
