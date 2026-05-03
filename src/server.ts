import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'

dotenv.config()

const app = Fastify({ logger: true })

// Plugins
app.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
})

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'secret',
})

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes
import { authRoutes }    from './routes/auth'
import { userRoutes }    from './routes/users'
import { gameRoutes }    from './routes/games'
import { spreadRoutes }  from './routes/spreads'
import { paymentRoutes } from './routes/payments'
import { drawRoutes }    from './routes/draws'
import { analysisRoutes }from './routes/analysis'

app.register(authRoutes,     { prefix: '/api/auth'     })
app.register(userRoutes,     { prefix: '/api/users'    })
app.register(gameRoutes,     { prefix: '/api/games'    })
app.register(spreadRoutes,   { prefix: '/api/spreads'  })
app.register(paymentRoutes,  { prefix: '/api/payments' })
app.register(drawRoutes,     { prefix: '/api/draws'    })
app.register(analysisRoutes, { prefix: '/api/analysis' })

// Start
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
