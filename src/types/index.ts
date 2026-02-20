// TypeScript enums for string-based Prisma fields (SQLite compatible)

export enum SourceChannel {
  GMAIL = "GMAIL",
  DISCORD = "DISCORD",
  SLACK = "SLACK",
  MANUAL = "MANUAL",
}

export enum TodoStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
  ARCHIVED = "ARCHIVED",
}

export enum TodoPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum LinkType {
  AUTO = "AUTO",
  MANUAL = "MANUAL",
  SUGGESTED = "SUGGESTED",
}

export enum BundleStatus {
  SUGGESTED = "SUGGESTED",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

export enum SyncStatus {
  SUCCESS = "SUCCESS",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
}
