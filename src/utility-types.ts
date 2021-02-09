export type Draft<T> = { -readonly [P in keyof T]?: T[P] }
