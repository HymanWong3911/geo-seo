// 共享 BullMQ Redis 连接。
// 真正的 connection 实例定义在 src/lib/queue.ts，这里只是 re-export，
// 让 src/lib/queue/* 下的模块可以就近 import 不会与 queue.ts 冲突。
export { connection } from "../queue";
