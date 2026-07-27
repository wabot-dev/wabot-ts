/**
 * Base for the in-memory answer to a `@projection`. Implement the projection's
 * methods under the same names; the framework routes every call here when the
 * active backend cannot run statements.
 *
 * ```typescript
 * @memExtension(CustomerRevenue)
 * export class CustomerRevenueMemory extends MemoryProjectionExtension {
 *   constructor(private orders: OrderRepository) { super() }
 *
 *   async topSpenders(limit: number): Promise<CustomerRevenueRow[]> { … }
 * }
 * ```
 *
 * Unlike a repository extension it is handed no store — a projection has none —
 * so it is resolved through the container and can inject whatever it derives
 * its answer from.
 */
export abstract class MemoryProjectionExtension {}
