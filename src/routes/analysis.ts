import { FastifyInstance } from 'fastify'

export async function analysisRoutes(app: FastifyInstance) {
  app.post('/spread', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const body = req.body as any
    const configs: Record<string, { drawSize: number; universe: number }> = {
      megasena: { drawSize:6, universe:60 }, quina: { drawSize:5, universe:80 }, lotofacil: { drawSize:15, universe:25 }
    }
    const cfg = configs[body.lottery] || configs.megasena
    const groupNumbers: number[] = []
    while (groupNumbers.length < body.groupSize) {
      const n = Math.floor(Math.random() * cfg.universe) + 1
      if (!groupNumbers.includes(n)) groupNumbers.push(n)
    }
    groupNumbers.sort((a,b) => a-b)
    const columnAllocs = Array.from({ length: cfg.drawSize }, (_, i) => ({ col: i+1, numbers: groupNumbers[i] ? [groupNumbers[i]] : [] }))
    function comb(arr: number[], k: number): number[][] {
      if (k===0) return [[]]
      if (arr.length<k) return []
      const [first,...rest] = arr
      return [...comb(rest,k-1).map(c=>[first,...c]),...comb(rest,k)]
    }
    const combinations = comb(groupNumbers, cfg.drawSize).slice(0,50).map((nums,i) => ({ index:i+1, numbers:nums, score:Math.max(60,86-i*2), warnings:[] }))
    const price = body.lottery==='megasena' ? 6 : body.lottery==='quina' ? 3 : 3.5
    return { groupNumbers, columnAllocs, combinations, totalCost: combinations.length * price }
  })

  app.post('/post-draw', async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ message: 'Não autorizado' }) }
    const body = req.body as any
    const drawn: number[] = body.drawn || []
    const played: number[] = body.played || []
    const cols = drawn.map((d,i) => {
      const p = played[i] || 0
      const diff = Math.abs(p-d)
      const status = p===d ? 'exact' : diff<=3 ? 'nearby' : 'group'
      return { col:i+1, played:p, drawn:d, status, playedTier:'strong', drawnTier:'strong', diff }
    })
    const exactCount = cols.filter(c=>c.status==='exact').length
    const groupCount = cols.filter(c=>c.status==='group').length
    const nearbyCount = cols.filter(c=>c.status==='nearby').length
    const missCount = cols.filter(c=>c.status==='miss').length
    const overallScore = Math.round((exactCount*100+groupCount*60+nearbyCount*30)/(cols.length||1))
    return { lottery:body.lottery, drawNumber:0, drawDate:new Date().toISOString(), played, drawn, cols, exactCount, groupCount, nearbyCount, missCount, overallScore, insight:`Seu jogo teve ${exactCount} acerto${exactCount!==1?'s':''} exato${exactCount!==1?'s':''}. ${exactCount>=3?'Excelente!':'Continue ajustando as colunas.'}` }
  })
}
