import { FastifyInstance } from 'fastify'

const LOTERIA_API = 'https://loteriascaixa-api.herokuapp.com/api'

interface CaixaResult {
  concurso?: number
  data?: string
  dezenas?: string[]
}

async function fetchLatestDraw(lottery: string): Promise<CaixaResult> {
  const map: Record<string, string> = { megasena: 'megasena', quina: 'quina', lotofacil: 'lotofacil' }
  const endpoint = map[lottery] || 'megasena'
  const res = await fetch(`${LOTERIA_API}/${endpoint}/latest`)
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`)
  return res.json() as Promise<CaixaResult>
}

export async function drawRoutes(app: FastifyInstance) {
  app.get('/next', async () => ({ lottery: 'Mega-Sena', date: new Date().toISOString(), label: 'Sábado, 04/mai às 20h' }))

  app.get('/latest/:lottery', async (req, reply) => {
    const { lottery } = req.params as { lottery: string }
    try {
      const data = await fetchLatestDraw(lottery)
      return { concurso: data.concurso ?? null, date: data.data ?? null, numbers: (data.dezenas ?? []).map(Number), lottery }
    } catch (e) {
      console.error('Erro ao buscar último resultado:', e)
      return reply.status(500).send({ message: 'Erro ao buscar resultado da Caixa' })
    }
  })

  app.get('/:lottery/:concurso', async (req, reply) => {
    const { lottery, concurso } = req.params as { lottery: string; concurso: string }
    try {
      const map: Record<string, string> = { megasena: 'megasena', quina: 'quina', lotofacil: 'lotofacil' }
      const endpoint = map[lottery] || 'megasena'
      const res = await fetch(`${LOTERIA_API}/${endpoint}/${concurso}`)
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`)
      const data = await res.json() as CaixaResult
      return { concurso: data.concurso ?? null, date: data.data ?? null, numbers: (data.dezenas ?? []).map(Number) }
    } catch {
      return reply.status(404).send({ message: 'Concurso não encontrado' })
    }
  })
}
