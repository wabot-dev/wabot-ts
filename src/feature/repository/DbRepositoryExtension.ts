/**
 * Marker base class for database-backed repository extensions. Every engine +
 * storage-strategy base — `PgJsonbRepositoryExtension`,
 * `PgColumnsRepositoryExtension`, and future ones — extends this. It lets
 * `@dbExtension` validate that a class is a database extension regardless of
 * engine and register it under the single `DB_EXTENSION_ID` slot.
 *
 * The concrete base an extension extends says which engine and strategy it can
 * serve (via its `static storage`), and `@dbExtension` checks that against what
 * the repository declares. This class carries no behaviour of its own.
 */
export abstract class DbRepositoryExtension {}
