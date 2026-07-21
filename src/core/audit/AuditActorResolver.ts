import { singleton } from '@/core/injection'
import { IAuditActor } from './IAuditActor'

/**
 * Maps the app's auth info onto an audited actor. **Optional**: the framework
 * never guesses an id from `Auth<D>` (its shape is app-defined). By default an
 * authenticated action is recorded as a bare `{ type: 'user' }`. Override this
 * (register your subclass) to attribute a real id/label:
 *
 * ```ts
 * class MyAuditActor extends AuditActorResolver {
 *   fromAuth(info: MyAuthInfo): IAuditActor {
 *     return { type: 'user', id: info.userId, label: info.email }
 *   }
 * }
 * container.register(AuditActorResolver, { useClass: MyAuditActor })
 * ```
 */
@singleton()
export class AuditActorResolver {
  fromAuth(_authInfo: unknown): IAuditActor {
    return { type: 'user' }
  }
}
