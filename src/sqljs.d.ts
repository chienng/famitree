declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: unknown[] | Record<string, unknown>): void
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }
  export interface Statement {
    bind(params?: unknown[] | Record<string, unknown>): void
    step(): boolean
    run(params?: unknown[]): void
    getAsObject(): Record<string, unknown>
    free(): void
  }
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | number[]) => Database
  }
  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }
  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
}
