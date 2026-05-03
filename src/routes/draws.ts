import { FastifyInstance } from 'fastify'

export async function drawRoutes(app: FastifyInstance) {
  app.get('/next', async () => ({
    lottery: 'Mega-Sena', date: new Date().toISOString(), label: 'Sábado, 04/mai às 20h'
  }))

  app.get('/:lottery/:concurso', async (req) => {
    const { lottery } = req.params as { lottery: string }
    const results: Record<string, number[]> = {
      megasena: [8,17,29,37,46,58], quina: [5,19,33,47,62], lotofacil: [1,3,5,7,9,11,13,15,17,19,21,22,23,24,25]
    }
    return { numbers: results[lottery] || results.megasena }
  })
}
