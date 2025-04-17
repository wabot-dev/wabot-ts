import dotenv from 'dotenv'
dotenv.config()

import { MindsetCmdInterface } from '@'
import { EliaMindset } from './EliaMindset'

new MindsetCmdInterface(EliaMindset).start()
