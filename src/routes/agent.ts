import { FastifyInstance } from 'fastify'

export async function agentRoutes(app: FastifyInstance) {
  app.post('/chat', async (req, reply) => {
    const body = req.body as { messages: { role: string; content: string }[]; context?: string }

    const systemPrompt =
      'Voce e o assistente especialista em loterias do LotoLogic, plataforma de analise estatistica de loterias brasileiras.\n\n' +
      (body.context ? 'Dados estatisticos reais:\n' + body.context + '\n\n' : '') +
      'Seu papel:\n' +
      '- Explicar a analise por colunas (cada posicao do sorteio analisada separadamente)\n' +
      '- Ajudar o apostador a entender numeros fortes, medios e fracos\n' +
      '- Explicar o equilibrio par/impar em cada coluna\n' +
      '- Sugerir estrategias baseadas no historico real de 2025\n' +
      '- Quando sugerido um jogo, explicar o motivo de cada numero com base nos dados historicos\n' +
      '- Criar a sensacao de que o apostador passou perto de acertar\n\n' +
      'Regras:\n' +
      '- Seja positivo e encorajador\n' +
      '- Use dados reais quando disponiveis\n' +
      '- Explique de forma simples para leigos\n' +
      '- Nunca prometa ganhos, fale em probabilidades\n' +
      '- Responda em portugues brasileiro, de forma natural e amigavel'

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: body.messages,
        }),
      })

      const data = await response.json() as any
      const text = data.content?.[0]?.text || 'Desculpe, tive um problema ao responder.'
      return { text }
    } catch (e: any) {
      return reply.status(500).send({ message: 'Erro ao chamar Claude', detail: e.message })
    }
  })
}
