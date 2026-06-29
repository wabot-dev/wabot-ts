import { test } from 'node:test'

import {
  chatAdapterConformanceCases,
  IChatAdapterConformanceReq,
} from '@/testing/conformance/chatAdapterConformanceCases'

export interface ItestChatAdapterReq extends IChatAdapterConformanceReq {}

/** node:test wrapper over the runner-agnostic adapter conformance cases. */
export function testChatAdapter(req: ItestChatAdapterReq) {
  for (const conformanceCase of chatAdapterConformanceCases(req)) {
    test(conformanceCase.name, conformanceCase.run)
  }
}
