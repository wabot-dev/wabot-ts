/**
 * Marker base class for database-backed repository extensions. Every engine +
 * storage-strategy base — `PgJsonbRepositoryExtension`, `PgSqlRepositoryExtension`,
 * and future `MysqlRepositoryExtension`, etc. — extends this. It lets
 * `@dbExtension` validate that a class is a database extension regardless of
 * engine and register it under the single `DB_EXTENSION_ID` slot.
 *
 * The concrete base an extension extends is what actually selects the engine
 * and the storage strategy (JSONB auto-managed vs. relational + migrations);
 * this class carries no behaviour of its own.
 */
export abstract class DbRepositoryExtension {}
