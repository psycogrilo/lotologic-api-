import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'
import { execSync } from 'child_process'
dotenv.config()

try {
  console.log('Rodando migrations...')
  execSync('npx prisma migrate deploy', { stdio: 'inherit' })
  console.log('Migrations concluidas!')
} catch (e) {
  console.error('Erro nas migrations:', e)
}

const app = Fastify({ logger: true })
app.register(cors, { origin: true, credentials: true })
app.register(jwt, { secret: process.env.JWT_SECRET || 'secret' })
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

import { authRoutes }     from './routes/auth'
import { userRoutes }     from './routes/users'
import { gameRoutes }     from './routes/games'
import { spreadRoutes }   from './routes/spreads'
import { paymentRoutes }  from './routes/payments'
import { drawRoutes }     from './routes/draws'
import { analysisRoutes } from './routes/analysis'
import { agentRoutes } from './routes/agent'
import { statsRoutes }    from './routes/stats'

app.register(authRoutes,     { prefix: '/api/auth'     })
app.register(userRoutes,     { prefix: '/api/users'    })
app.register(gameRoutes,     { prefix: '/api/games'    })
app.register(spreadRoutes,   { prefix: '/api/spreads'  })
app.register(paymentRoutes,  { prefix: '/api/payments' })
app.register(drawRoutes,     { prefix: '/api/draws'    })
app.register(analysisRoutes, { prefix: '/api/analysis' })
app.register(agentRoutes, { prefix: '/api/agent' })
app.register(statsRoutes,    { prefix: '/api/stats'    })

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`🚀 LotoLogic API rodando em http://localhost:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}
start()
