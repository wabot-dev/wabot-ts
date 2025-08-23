import { container as c, runChatControllers } from '@'
import { Pool } from 'pg'
import { EliaChatController } from './EliaChatController'

import { EliaEventRestController } from './EliaEventRestController'

c.registerInstance(Pool, new Pool({ connectionString: process.env.DATABASE_URL }))

runChatControllers([EliaChatController, EliaEventRestController])
