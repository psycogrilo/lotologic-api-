import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const LOTERIA_API = 'https://loteriascaixa-api.herokuapp.com/api'
const LOTTERY_CONFIG: Record<string, { drawSize: number; universe: number; slug: string }> = {
  megasena:  { drawSize: 6,  universe: 60, slug: 'megasena'  },
  lotofacil: { drawSize: 15, universe: 25, slug: 'lotofacil' },
}
interface ApiDraw { concurso: number; data: string; dezenas: string[] }
async function fetchAllDrawsSince2025(lottery: string) {
  const cfg = LOTTERY_CONFIG[lottery]
  if (!cfg) throw new Error('Loteria não suportada')
  const latestRes = await fetch(`${LOTERIA_API}/${cfg.slug}/latest`)
  if (!latestRes.ok) throw new Error('Erro ao buscar último concurso')
  const latest = await latestRes.json() as ApiDraw
  const results: ApiDraw[] = []
  for (let i = latest.concurso; i >= 1; i--) {
    try {
      const res = await fetch(`${LOTERIA_API}/${cfg.slug}/${i}`)
      if (!res.ok) break
      const draw = await res.json() as ApiDraw
      const [day, month, year] = draw.data.split('/')
      if (new Date(Number(year), Number(month) - 1, Number(day)) < new Date('2025-01-01')) break
      results.push(draw)
    } catch { break }
  }
  return results
}
function analyzeColumn(draws: { numbers: number[] }[], colIndex: number, universe: number, previousChoices: number[]) {
  let filtered = draws
  if (previousChoices.length > 0) {
    filtered = draws.filter(d => previousChoices.every((n, i) => d.numbers[i] === n))
    if (filtered.length < 5) filtered = draws
  }
  const freq: Record<number, number> = {}
  for (let n = 1; n <= universe; n++) freq[n] = 0
  let oddCount = 0, evenCount = 0
  for (const draw of filtered) {
    const num = draw.numbers[colIndex]
    if (num) { freq[num] = (freq[num] || 0) + 1; num % 2 === 0 ? evenCount++ : oddCount++ }
  }
  const total = filtered.length || 1
  const oddPct  = Math.round((oddCount  / total) * 100)
  const evenPct = Math.round((evenCount / total) * 100)
  const entries = Object.entries(freq).map(([n, count]) => ({ number: Number(n), count, pct: Math.round((count / total) * 100) })).filter(e => e.count > 0).sort((a, b) => b.count - a.count)
  const s30 = Math.ceil(entries.length * 0.3)
  const w30 = Math.ceil(entries.length * 0.3)
  const strong = entries.slice(0, s30)
  const weak   = entries.slice(entries.length - w30)
  const medium = entries.slice(s30, entries.length - w30)
  const st = strong.reduce((s, e) => s + e.count, 0)
  const mt = medium.reduce((s, e) => s + e.count, 0)
  const wt = weak.reduce((s, e) => s + e.count, 0)
  const gt = st + mt + wt || 1
  const groupProbabilities = { strong: Math.round((st/gt)*100), medium: Math.round((mt/gt)*100), weak: Math.round((wt/gt)*100) }
  const dominantGroup = groupProbabilities.strong >= groupProbabilities.medium && groupProbabilities.strong >= groupProbabilities.weak ? 'strong' : groupProbabilities.medium >= groupProbabilities.weak ? 'medium' : 'weak'
  return { strong, medium, weak, dominantGroup: dominantGroup as 'strong'|'medium'|'weak', groupProbabilities, oddEven: { oddPct, evenPct, suggestion: oddPct > evenPct ? `${oddPct}% ímpar` : `${evenPct}% par` } }
}
export async function statsRoutes(app: FastifyInstance) {
  app.post('/sync/:lottery', async (req, reply) => {
    const { lottery } = req.params as { lottery: string }
    if (!LOTTERY_CONFIG[lottery]) return reply.status(400).send({ message: 'Loteria não suportada' })
    try {
      const draws = await fetchAllDrawsSince2025(lottery)
      let inserted = 0
      for (const draw of draws) {
        await prisma.drawResult.upsert({ where: { lottery_concurso: { lottery, concurso: draw.concurso } }, create: { lottery, concurso: draw.concurso, date: draw.data, numbers: draw.dezenas.map(Number) }, update: {} })
        inserted++
      }
      return { message: 'Sync concluído', lottery, total: inserted }
    } catch (e: any) { return reply.status(500).send({ message: 'Erro ao sincronizar', detail: e.message }) }
  })
  app.post('/update/:lottery', async (req, reply) => {
    const { lottery } = req.params as { lottery: string }
    const cfg = LOTTERY_CONFIG[lottery]
    if (!cfg) return reply.status(400).send({ message: 'Loteria não suportada' })
    try {
      const res = await fetch(`${LOTERIA_API}/${cfg.slug}/latest`)
      const draw = await res.json() as ApiDraw
      await prisma.drawResult.upsert({ where: { lottery_concurso: { lottery, concurso: draw.concurso } }, create: { lottery, concurso: draw.concurso, date: draw.data, numbers: draw.dezenas.map(Number) }, update: {} })
      return { message: 'Atualizado', concurso: draw.concurso, date: draw.data }
    } catch (e: any) { return reply.status(500).send({ message: 'Erro ao atualizar', detail: e.message }) }
  })
  app.get('/:lottery/column/:col', async (req, reply) => {
    const { lottery, col } = req.params as { lottery: string; col: string }
    const { previous } = req.query as { previous?: string }
    const cfg = LOTTERY_CONFIG[lottery]
    if (!cfg) return reply.status(400).send({ message: 'Loteria não suportada' })
    const colIndex = Number(col) - 1
    if (colIndex < 0 || colIndex >= cfg.drawSize) return reply.status(400).send({ message: 'Coluna inválida' })
    const previousChoices = previous ? previous.split(',').map(Number).filter(n => !isNaN(n)) : []
    const draws = await prisma.drawResult.findMany({ where: { lottery } })
    if (draws.length === 0) return reply.status(404).send({ message: 'Sem dados históricos.' })
    const result = analyzeColumn(draws, colIndex, cfg.universe, previousChoices)
    return { lottery, col: Number(col), totalDraws: draws.length, filteredBy: previousChoices, ...result }
  })
  app.post('/generate', async (req, reply) => {
    const body = req.body as { lottery: string; anchors?: { col: number; number: number }[]; betSize?: number }
    const cfg = LOTTERY_CONFIG[body.lottery]
    if (!cfg) return reply.status(400).send({ message: 'Loteria não suportada' })
    const betSize = body.betSize || cfg.drawSize
    const draws = await prisma.drawResult.findMany({ where: { lottery: body.lottery } })
    if (draws.length === 0) return reply.status(404).send({ message: 'Sem dados históricos.' })
    const anchors = body.anchors || []
    const chosen: number[] = []
    for (let col = 0; col < betSize; col++) {
      const anchor = anchors.find(a => a.col === col + 1)
      if (anchor) { chosen.push(anchor.number); continue }
      const analysis = analyzeColumn(draws, col % cfg.drawSize, cfg.universe, chosen)
      const pool = analysis.dominantGroup === 'strong' ? analysis.strong : analysis.dominantGroup === 'medium' ? analysis.medium : analysis.weak
      const totalWeight = pool.reduce((s, e) => s + e.count, 0) || 1
      let rand = Math.random() * totalWeight
      let picked = pool[0]?.number ?? 1
      for (const entry of pool) { rand -= entry.count; if (rand <= 0) { picked = entry.number; break } }
      if (chosen.includes(picked)) { const fb = pool.find(e => !chosen.includes(e.number)); picked = fb?.number ?? picked }
      chosen.push(picked)
    }
    const suggested: number[] = []
    for (let col = 0; col < betSize; col++) {
      const analysis = analyzeColumn(draws, col % cfg.drawSize, cfg.universe, suggested)
      const top = analysis.strong.find(e => !suggested.includes(e.number))
      suggested.push(top?.number ?? analysis.strong[0]?.number ?? 1)
    }
    return { lottery: body.lottery, numbers: chosen.sort((a,b)=>a-b), suggestedNumbers: suggested, anchors: anchors.map(a => a.number), mode: anchors.length > 0 ? 'anchored' : 'auto', betSize }
  })
  app.get('/status', async () => {
    const megasena  = await prisma.drawResult.count({ where: { lottery: 'megasena'  } })
    const lotofacil = await prisma.drawResult.count({ where: { lottery: 'lotofacil' } })
    return { megasena, lotofacil, total: megasena + lotofacil }
  })
}
