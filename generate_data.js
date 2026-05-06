const fs = require('fs')
const path = require('path')

const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

const regions = {
  'North America': ['U.S.', 'Canada'],
  Europe: ['U.K.', 'Germany', 'Italy', 'France', 'Spain', 'Russia', 'Rest of Europe'],
  'Asia Pacific': ['China', 'India', 'Japan', 'South Korea', 'ASEAN', 'Australia', 'Rest of Asia Pacific'],
  'Latin America': ['Brazil', 'Argentina', 'Mexico', 'Rest of Latin America'],
  'Middle East & Africa': ['GCC', 'South Africa', 'Rest of Middle East & Africa']
}

const regionBaseValues = {
  'North America': 920,
  Europe: 640,
  'Asia Pacific': 410,
  'Latin America': 175,
  'Middle East & Africa': 138
}

const countryShares = {
  'North America': { 'U.S.': 0.82, Canada: 0.18 },
  Europe: {
    'U.K.': 0.18,
    Germany: 0.22,
    Italy: 0.12,
    France: 0.16,
    Spain: 0.1,
    Russia: 0.08,
    'Rest of Europe': 0.14
  },
  'Asia Pacific': {
    China: 0.28,
    India: 0.12,
    Japan: 0.25,
    'South Korea': 0.12,
    ASEAN: 0.1,
    Australia: 0.07,
    'Rest of Asia Pacific': 0.06
  },
  'Latin America': { Brazil: 0.45, Argentina: 0.15, Mexico: 0.25, 'Rest of Latin America': 0.15 },
  'Middle East & Africa': { GCC: 0.45, 'South Africa': 0.25, 'Rest of Middle East & Africa': 0.3 }
}

const regionGrowthRates = {
  'North America': 0.11,
  Europe: 0.103,
  'Asia Pacific': 0.135,
  'Latin America': 0.118,
  'Middle East & Africa': 0.112
}

const volumePerMillionUSD = 2.8

/** Flat segment type -> leaf name -> share of regional total (sums to ~1 per type) */
const flatShares = {
  'By Deployment Mode': {
    Cloud: 0.62,
    'On-Premises': 0.38
  },
  'By Organization Size': {
    'Small Enterprises': 0.24,
    'Medium Enterprises': 0.38,
    'Large Enterprises': 0.38
  }
}

/**
 * Nested: parent -> leaf -> relative weight within parent (normalized per parent)
 * Parent rollup is computed automatically.
 */
const nestedByComponent = {
  'Solutions / Platforms': {
    'Compliance Management Software': 0.14,
    'Policy Management Software': 0.12,
    'Risk & Control Management Software': 0.14,
    'Audit Management Software': 0.12,
    'Regulatory Change Management Software': 0.11,
    'Reporting & Analytics Software': 0.13,
    'Third-Party / Vendor Compliance Software': 0.1,
    'Documentation & Evidence Management Software': 0.09,
    'Certification / Attestation Management Software': 0.05
  },
  Services: {
    'Consulting & Advisory Services': 0.32,
    'Implementation & Integration Services': 0.28,
    'Managed Compliance Services': 0.24,
    'Training, Support & Maintenance Services': 0.16
  }
}

/** Parent shares of Industry Vertical totals (nested parts + leaves) */
const industryParentWeights = {
  BFSI: 0.18,
  'Healthcare & Life Sciences': 0.16,
  'Technology, Media & Telecom': 0.14,
  'Government & Public Sector': 0.11,
  'Manufacturing & Industrials': 0.1,
  'Retail, E-commerce & Consumer Goods': 0.1,
  'Energy & Utilities': 0.08,
  'Transportation & Logistics': 0.07,
  'Others (Education & EdTech, Professional Services & Real Estate, etc.)': 0.06
}

const nestedIndustry = {
  BFSI: {
    Banking: 0.34,
    Insurance: 0.28,
    'Capital Markets': 0.22,
    Fintech: 0.16
  },
  'Healthcare & Life Sciences': {
    Hospitals: 0.38,
    'Pharma & Biotech': 0.27,
    'Medical Devices': 0.18,
    HealthTech: 0.17
  },
  'Technology, Media & Telecom': {
    'Cloud Service Providers': 0.32,
    'Telecom Operators': 0.28,
    'Data Center Providers': 0.22,
    'Media & Entertainment': 0.18
  },
  'Manufacturing & Industrials': {
    'Discrete Manufacturing': 0.58,
    'Process Manufacturing': 0.42
  },
  'Energy & Utilities': {
    'Power Utilities': 0.32,
    'Oil & Gas': 0.26,
    'Renewable Energy': 0.25,
    'Water Utilities': 0.17
  },
  'Transportation & Logistics': {
    Aviation: 0.38,
    Maritime: 0.22,
    'Rail & Road Transport': 0.4
  }
}

const leafOnlyIndustry = ['Government & Public Sector', 'Retail, E-commerce & Consumer Goods', 'Others (Education & EdTech, Professional Services & Real Estate, etc.)']

function normalizeWeights(w) {
  const sum = Object.values(w).reduce((a, b) => a + b, 0)
  const o = {}
  Object.keys(w).forEach(k => {
    o[k] = w[k] / sum
  })
  return o
}

let seed = 42
function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647
  return (seed - 1) / 2147483646
}

function addNoise(value, noiseLevel = 0.028) {
  return value * (1 + (seededRandom() - 0.5) * 2 * noiseLevel)
}

function roundTo1(val) {
  return Math.round(val * 10) / 10
}

function roundToInt(val) {
  return Math.round(val)
}

function generateTimeSeries(baseValue, growthRate, roundFn) {
  const series = {}
  for (let i = 0; i < years.length; i++) {
    const year = years[i]
    const rawValue = baseValue * Math.pow(1 + growthRate, i)
    series[year] = roundFn(addNoise(rawValue))
  }
  return series
}

function sumSeriesMap(childrenObjects, roundFn) {
  const out = {}
  years.forEach(y => {
    const raw = childrenObjects.reduce((s, obj) => s + (obj[y] || 0), 0)
    out[y] = roundFn ? roundFn(raw) : raw
  })
  return out
}

/** Default CAGR tweak by segment keyword (applied as multiplier on geography growth) */
function segmentGrowthMultiplier(segmentType, leafName, parentName) {
  const n = `${leafName} ${parentName || ''}`
  let m = 1
  if (segmentType === 'By Component') {
    if (/Managed|Consulting/i.test(leafName)) m *= 1.06
    if (/Reporting|Analytics/i.test(leafName)) m *= 1.08
    if (/Implementation/i.test(leafName)) m *= 1.04
  }
  if (segmentType === 'By Deployment Mode') {
    if (/Cloud/i.test(leafName)) m *= 1.09
    if (/Premises/i.test(leafName)) m *= 0.96
  }
  if (segmentType === 'By Organization Size') {
    if (/Large/i.test(leafName)) m *= 1.03
    if (/Small/i.test(leafName)) m *= 1.05
  }
  if (segmentType === 'By Industry Vertical') {
    if (/Fintech|HealthTech|Renewable/i.test(n)) m *= 1.1
    if (/Government/i.test(leafName)) m *= 0.98
  }
  return m
}

function buildFlatSegmentTrees(regionGrowth, geoBaseForSegments, multiplier, segmentType, roundFn, countryGrowthOverride) {
  const growthUse = countryGrowthOverride ?? regionGrowth
  const out = {}
  const shares = flatShares[segmentType]
  for (const leaf of Object.keys(shares)) {
    const share = shares[leaf]
    const m = segmentGrowthMultiplier(segmentType, leaf, null)
    out[leaf] = generateTimeSeries(geoBaseForSegments * share * multiplier, growthUse * m, roundFn)
  }
  return out
}

function buildNestedTrees(regionGrowth, geoBaseForSegments, multiplier, nestedDef, segmentType, roundFn, countryGrowthOverride) {
  const growthUse = countryGrowthOverride ?? regionGrowth
  const out = {}
  for (const parent of Object.keys(nestedDef)) {
    const rawChildWeights = normalizeWeights(nestedDef[parent])
    const leaves = []
    let parentShareBudget = industryParentWeights[parent] || 0
    if (nestedDef === nestedByComponent) {
      parentShareBudget = parent === 'Solutions / Platforms' ? 0.68 : 0.32
    }

    for (const leaf of Object.keys(rawChildWeights)) {
      const w = rawChildWeights[leaf]
      const absShare = parentShareBudget * w
      const m = segmentGrowthMultiplier(segmentType, leaf, parent)
      const leafSeries = generateTimeSeries(geoBaseForSegments * absShare * multiplier, growthUse * m, roundFn)
      leaves.push(leafSeries)
      if (!out[parent]) out[parent] = {}
      out[parent][leaf] = leafSeries
    }
    out[parent] = { ...sumSeriesMap(leaves, roundFn), ...out[parent] }
  }
  return out
}

function buildIndustryTrees(regionGrowth, geoBaseForSegments, multiplier, roundFn, countryGrowthOverride) {
  const out = {}
  for (const parent of Object.keys(industryParentWeights)) {
    if (nestedIndustry[parent]) {
      Object.assign(
        out,
        buildNestedTrees(
          regionGrowth,
          geoBaseForSegments,
          multiplier,
          { [parent]: nestedIndustry[parent] },
          'By Industry Vertical',
          roundFn,
          countryGrowthOverride
        )
      )
    } else if (leafOnlyIndustry.includes(parent)) {
      const w = industryParentWeights[parent]
      const m = segmentGrowthMultiplier('By Industry Vertical', parent, null)
      const growthUse = countryGrowthOverride ?? regionGrowth
      out[parent] = generateTimeSeries(geoBaseForSegments * w * multiplier, growthUse * m, roundFn)
    }
  }
  return out
}

function buildAllSegmentTrees(regionGrowth, geoBaseForSegments, multiplier, roundFn, countryGrowthOverride) {
  return {
    'By Component': buildNestedTrees(
      regionGrowth,
      geoBaseForSegments,
      multiplier,
      nestedByComponent,
      'By Component',
      roundFn,
      countryGrowthOverride
    ),
    'By Deployment Mode': buildFlatSegmentTrees(regionGrowth, geoBaseForSegments, multiplier, 'By Deployment Mode', roundFn, countryGrowthOverride),
    'By Organization Size': buildFlatSegmentTrees(regionGrowth, geoBaseForSegments, multiplier, 'By Organization Size', roundFn, countryGrowthOverride),
    'By Industry Vertical': buildIndustryTrees(regionGrowth, geoBaseForSegments, multiplier, roundFn, countryGrowthOverride)
  }
}

function generateData(isVolume) {
  const data = {}
  const roundFn = isVolume ? roundToInt : roundTo1
  const multiplier = isVolume ? volumePerMillionUSD : 1

  for (const [regionName, countries] of Object.entries(regions)) {
    const regionBase = regionBaseValues[regionName] * multiplier
    const regionGrowth = regionGrowthRates[regionName]

    data[regionName] = {}
    const segTrees = buildAllSegmentTrees(regionGrowth, regionBase, multiplier, roundFn)
    Object.assign(data[regionName], segTrees)

    data[regionName]['By Country'] = {}
    for (const country of countries) {
      const cShare = countryShares[regionName][country]
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.055
      const countryGrowth = regionGrowth * countryGrowthVariation
      data[regionName]['By Country'][country] = generateTimeSeries(regionBase * cShare, countryGrowth, roundFn)
    }

    for (const country of countries) {
      const cShare = countryShares[regionName][country]
      const countryBase = regionBase * cShare
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.038
      const countryGrowth = regionGrowth * countryGrowthVariation

      data[country] = {}
      const countrySegTrees = buildAllSegmentTrees(regionGrowth, countryBase, multiplier, roundFn, countryGrowth)
      Object.assign(data[country], countrySegTrees)
    }
  }

  return data
}

function buildSegmentationSkeleton() {
  function emptyNested(def) {
    const o = {}
    for (const k of Object.keys(def)) {
      if (typeof def[k] === 'object' && def[k] !== null && !Array.isArray(def[k])) {
        const inner = {}
        for (const c of Object.keys(def[k])) inner[c] = {}
        o[k] = inner
      } else o[k] = {}
    }
    return o
  }

  const byRegion = {}
  for (const [regionName, countries] of Object.entries(regions)) {
    const c = {}
    countries.forEach(ct => {
      c[ct] = {}
    })
    byRegion[regionName] = c
  }

  const industrySkeleton = {}
  for (const p of Object.keys(industryParentWeights)) {
    if (nestedIndustry[p]) {
      industrySkeleton[p] = {}
      for (const c of Object.keys(nestedIndustry[p])) {
        industrySkeleton[p][c] = {}
      }
    } else {
      industrySkeleton[p] = {}
    }
  }

  return {
    Global: {
      'By Component': emptyNested(nestedByComponent),
      'By Deployment Mode': emptyNested(flatShares['By Deployment Mode']),
      'By Organization Size': emptyNested(flatShares['By Organization Size']),
      'By Industry Vertical': industrySkeleton,
      'By Region': byRegion
    }
  }
}

seed = 42
const valueData = generateData(false)
seed = 7777
const volumeData = generateData(true)

const outDir = path.join(__dirname, 'public', 'data')
fs.writeFileSync(path.join(outDir, 'value.json'), JSON.stringify(valueData, null, 2))
fs.writeFileSync(path.join(outDir, 'volume.json'), JSON.stringify(volumeData, null, 2))

const segmentationSkeleton = buildSegmentationSkeleton()
fs.writeFileSync(path.join(outDir, 'segmentation_analysis.json'), JSON.stringify(segmentationSkeleton, null, 2))

console.log('Generated value.json, volume.json, segmentation_analysis.json')
console.log('North America segment types:', Object.keys(valueData['North America']))
console.log('Sample By Component:', JSON.stringify(valueData['North America']['By Component'], null, 2).slice(0, 600))
