import { FastifyInstance } from 'fastify'

const CAIXA_API = 'https://servicebus2.caixa.gov.br/portaldeloterias/api'

async function fetchLatestDraw(lottery: string) {
  const map: Record<string, string> = {
    megasena: 'megasena',
    quina: 'quina',
    lotofacil: 'lotofacil',
  }
  const endpoint = map[lottery] || 'megasena'
  const res = await fetch(`${CAIXA_API}/${endpoint}`)
  if (!res.ok) throw new Error('Erro ao buscar resultado')
  return res.json()
}

export async function drawRoutes(app: FastifyInstance) {
  app.get('/next', async () => ({
    lottery: 'Mega-Sena',
    date: new Date().toISOString(),
    label: 'Sábado, 04/mai às 20h',
  }))

  app.get('/latest/:lottery', async (req, reply) => {
    const { lottery } = req.params as { lottery: string }
    try {
      const data = await fetchLatestDraw(lottery)
      return {
        concurso: data.numero,
        date: data.dataApuracao,
        numbers: data.listaDezenas?.map(Number) || [],
        lottery,
      }
    } catch (e) {
      return reply.status(500).send({ message: 'Erro ao buscar resultado da Caixa' })
    }
  })

  app.get('/:lottery/:concurso', async (req, reply) => {
    const { lottery, concurso } = req.params as { lottery: string; concurso: string }
    try {
      const map: Record<string, string> = {
        megasena: 'megasena', quina: 'quina', lotofacil: 'lotofacil',
      }
      const endpoint = map[lottery] || 'megasena'
      const res = await fetch(`${CAIXA_API}/${endpoint}/${concurso}`)
      const data = await res.json()
      return {
        concurso: data.numero,
        date: data.dataApuracao,
        numbers: data.listaDezenas?.map(Number) || [],
      }
    } catch {
      return reply.status(404).send({ message: 'Concurso não encontrado' })
    }
  })
}
