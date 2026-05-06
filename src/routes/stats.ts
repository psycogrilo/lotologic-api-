import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LOTERIA_API = 'https://loteriascaixa-api.herokuapp.com/api'

const LOTTERY_CONFIG: Record<string, { drawSize: number; universe: number; slug: string }> = {
  megasena:  { drawSize: 6,  universe: 60, slug: 'megasena'  },
  lotofacil: { drawSize: 15, universe: 25, slug: 'lotofacil' },
}

interface ApiDraw {
  concurso: number
  data: string
  dezenas: string[]
}

// Busca todos os sorteios de um ano até o mais recente
async function fetchAllDrawsSince2025(lottery: string): Promise<ApiDraw[]> {
  const cfg = LOTTERY_CONFIG[lottery]
  if (!cfg) throw new Error('Loteria não suportada')

  // Busca o último concurso para saber o número máximo
  const latestRes = await fetch(`${LOTERIA_API}/${cfg.slug}/latest`)
  if (!latestRes.ok) throw new Error('Erro ao buscar último concurso')
  const latest = await latestRes.json() as ApiDraw

  const latestNum = latest.concurso
  const results: ApiDraw[] = []

  // Busca de trás para frente até chegar em 2024
  for (let i = latestNum; i >= 1; i--) {
    try {
      const res = await fetch(`${LOTERIA_API}/${cfg.slug}/${i}`)
      if (!res.ok) break
      const draw = await res.json() as ApiDraw

      // Para quando chegar antes de 01/01/2025
      const [day, month, year] = draw.data.split('/')
      const drawDate = new Date(Number(year), Number(month) - 1, Number(day))
      if (drawDate < new Date('2025-01-01')) break

      results.push(draw)
    } catch {
      break
    }
  }

  return results
}

// Calcula Fortes / Médios / Fracos para uma coluna específica
// dado os números já escolhidos nas colunas anteriores (correlação condicional)
function analyzeColumn(
  draws: { numbers: number[] }[],
  colIndex: number,
  universe: number,
  previousChoices: number[]
): {
  strong: { number: number; count: number; pct: number }[]
  medium: { number: number; count: number; pct: number }[]
  weak:   { number: number; count: number; pct: number }[]
  dominantGroup: 'strong' | 'medium' | 'weak'
  groupProbabilities: { strong: number; medium: number; weak: number }
} {
  // Filtra apenas os sorteios onde os números das colunas anteriores batem
  let filtered = draws
  if (previousChoices.length > 0) {
    filtered = draws.filter(draw =>
      previousChoices.every((num, idx) => draw.numbers[idx] === num)
    )
    // Se filtro condicional tiver menos de 5 jogos, afrouxa e usa todos
    if (filtered.length < 5) filtered = draws
  }

  // Conta frequência de cada número na coluna atual
  const freq: Record<number, number> = {}
  for (let n = 1; n <= universe; n++) freq[n] = 0

  for (const draw of filtered) {
    const num = draw.numbers[colIndex]
    if (num) freq[num] = (freq[num] || 0) + 1
  }

  const total = filtered.length
  const entries = Object.entries(freq)
    .map(([n, count]) => ({ number: Number(n), count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count)

  const strong30 = Math.ceil(entries.length * 0.3)
  const weak30   = Math.ceil(entries.length * 0.3)

  const strong = entries.slice(0, strong30)
  const weak   = entries.slice(entries.length - weak30)
  const medium = entries.slice(strong30, entries.length - weak30)

  // Probabilidade de grupo dominante nesta coluna dado o contexto
  const strongTotal = strong.reduce((s, e) => s + e.count, 0)
  const mediumTotal = medium.reduce((s, e) => s + e.count, 0)
  const weakTotal   = weak.reduce((s, e) => s + e.count, 0)
  const grandTotal  = strongTotal + mediumTotal + weakTotal || 1

  const groupProbabilities = {
    strong: Math.round((strongTotal / grandTotal) * 100),
    medium: Math.round((mediumTotal / grandTotal) * 100),
    weak:   Math.round((weakTotal   / grandTotal) * 100),
  }

  const dominantGroup = groupProbabilities.strong >= groupProbabilities.medium && groupProbabilities.strong >= groupProbabilities.weak
    ? 'strong'
    : groupProbabilities.medium >= groupProbabilities.weak
      ? 'medium'
      : 'weak'

  return { strong, medium, weak, dominantGroup, groupProbabilities }
}

export async function statsRoutes(app: FastifyInstance) {

  // ─── Sync histórico ───────────────────────────────────────────────
  app.post('/sync/:lottery', async (req, reply) => {
    const { lottery } = req.params as { lottery: string }
    if (!LOTTERY_CONFIG[lottery]) return reply.status(400).send({ message: 'Loteria não suportada' })

    try {
      const draws = await fetchAllDrawsSince2025(lottery)
      let inserted = 0

      for (const draw of draws) {
        await prisma.drawResult.upsert({
          where: { lottery_concurso: { lottery, concurso: draw.concurso } },
          create: {
            lottery,
            concurso: draw.concurso,
            date: draw.data,
            numbers: draw.dezenas.map(Number),
          },
          update: {},
        })
        inserted++
      }

      return { message: `Sync concluído`, lottery, total: inserted }
    } catch (e: any) {
      console.error('Erro no sync:', e)
      return reply.status(500).send({ message: 'Erro ao sincronizar', detail: e.message })
    }
  })

  // ─── Atualiza com o último sorteio ────────────────────────────────
  app.post('/update/:lottery', async (req, reply) => {
    const { lottery } = req.params as { lottery: string }
    const cfg = LOTTERY_CONFIG[lottery]
    if (!cfg) return reply.status(400).send({ message: 'Loteria não suportada' })

    try {
      const res = await fetch(`${LOTERIA_API}/${cfg.slug}/latest`)
      const draw = await res.json() as ApiDraw

      await prisma.drawResult.upsert({
        where: { lottery_concurso: { lottery, concurso: draw.concurso } },
        create: { lottery, concurso: draw.concurso, date: draw.data, numbers: draw.dezenas.map(Number) },
        update: {},
      })

      return { message: 'Atualizado', concurso: draw.concurso, date: draw.data }
    } catch (e: any) {
      return reply.status(500).send({ message: 'Erro ao atualizar', detail: e.message })
    }
  })

  // ─── Análise de coluna ────────────────────────────────────────────
  // GET /api/stats/megasena/column/2?previous=8,17
  app.get('/:lottery/column/:col', async (req, reply) => {
    const { lottery, col } = req.params as { lottery: string; col: string }
    const { previous } = req.query as { previous?: string }
    const cfg = LOTTERY_CONFIG[lottery]
    if (!cfg) return reply.status(400).send({ message: 'Loteria não suportada' })

    const colIndex = Number(col) - 1
    if (colIndex < 0 || colIndex >= cfg.drawSize) return reply.status(400).send({ message: 'Coluna inválida' })

    const previousChoices = previous
      ? previous.split(',').map(Number).filter(n => !isNaN(n))
      : []

    const draws = await prisma.drawResult.findMany({ where: { lottery } })
    if (draws.length === 0) return reply.status(404).send({ message: 'Sem dados históricos. Execute o sync primeiro.' })

    const result = analyzeColumn(draws, colIndex, cfg.universe, previousChoices)

    return {
      lottery,
      col: Number(col),
      totalDraws: draws.length,
      filteredBy: previousChoices,
      ...result,
    }
  })

  // ─── Geração automática ───────────────────────────────────────────
  // POST /api/stats/generate
  // body: { lottery, anchors: { col: number, number: number }[] }
  app.post('/generate', async (req, reply) => {
    const body = req.body as { lottery: string; anchors?: { col: number; number: number }[] }
    const cfg = LOTTERY_CONFIG[body.lottery]
    if (!cfg) return reply.status(400).send({ message: 'Loteria não suportada' })

    const draws = await prisma.drawResult.findMany({ where: { lottery: body.lottery } })
    if (draws.length === 0) return reply.status(404).send({ message: 'Sem dados históricos. Execute o sync primeiro.' })

    const anchors = body.anchors || []
    const chosen: number[] = []

    for (let col = 0; col < cfg.drawSize; col++) {
      // Verifica se tem âncora para essa coluna
      const anchor = anchors.find(a => a.col === col + 1)
      if (anchor) {
        chosen.push(anchor.number)
        continue
      }

      // Analisa a coluna com o contexto das escolhas anteriores
      const analysis = analyzeColumn(draws, col, cfg.universe, chosen)

      // Escolhe baseado na probabilidade do grupo dominante
      const pool = analysis.dominantGroup === 'strong'
        ? analysis.strong
        : analysis.dominantGroup === 'medium'
          ? analysis.medium
          : analysis.weak

      // Pega um número aleatório do pool dominante (ponderado por frequência)
      const totalWeight = pool.reduce((s, e) => s + e.count, 0) || 1
      let rand = Math.random() * totalWeight
      let picked = pool[0]?.number ?? 1

      for (const entry of pool) {
        rand -= entry.count
        if (rand <= 0) { picked = entry.number; break }
      }

      // Garante que não repete número
      if (chosen.includes(picked)) {
        const fallback = pool.find(e => !chosen.includes(e.number))
        picked = fallback?.number ?? picked
      }

      chosen.push(picked)
    }

    // Calcula quais seriam os números sugeridos (top Fortes de cada coluna)
    const suggested: number[] = []
    for (let col = 0; col < cfg.drawSize; col++) {
      const analysis = analyzeColumn(draws, col, cfg.universe, suggested)
      const top = analysis.strong.find(e => !suggested.includes(e.number))
      suggested.push(top?.number ?? analysis.strong[0]?.number ?? 1)
    }

    return {
      lottery: body.lottery,
      numbers: chosen,
      suggestedNumbers: suggested,
      anchors: anchors.map(a => a.number),
      mode: anchors.length > 0 ? 'anchored' : 'auto',
    }
  })

  // ─── Status do banco histórico ────────────────────────────────────
  app.get('/status', async () => {
    const megasena  = await prisma.drawResult.count({ where: { lottery: 'megasena'  } })
    const lotofacil = await prisma.drawResult.count({ where: { lottery: 'lotofacil' } })
    return { megasena, lotofacil, total: megasena + lotofacil }
  })
}
