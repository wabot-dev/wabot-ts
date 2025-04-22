import { runServer } from '@/server/runServer'
import { EliaController } from './EliaController'

runServer({
  controllers: [EliaController],
})
