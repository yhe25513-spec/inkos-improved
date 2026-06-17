// ── 编辑追踪器 ────────────────────────────────────────
// 记录用户对AI生成文本的每次修改，作为偏好学习的数据源

import type { EditType, EditContext, UserEdit } from "./types.js";

/**
 * 编辑追踪器
 * 负责记录用户编辑操作，并在积累足够样本后触发偏好分析
 */
export class EditTracker {
  private batchSize: number;
  private editBuffer: UserEdit[] = [];
  private onBatchReady?: (userId: string, bookId: string) => Promise<void>;

  constructor(options?: { batchSize?: number }) {
    this.batchSize = options?.batchSize ?? 10;
  }

  /**
   * 设置批量处理回调
   */
  onBatch(callback: (userId: string, bookId: string) => Promise<void>): void {
    this.onBatchReady = callback;
  }

  /**
   * 记录一次编辑操作
   */
  trackEdit(edit: Omit<UserEdit, "id" | "timestamp">): UserEdit {
    const fullEdit: UserEdit = {
      ...edit,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    this.editBuffer.push(fullEdit);

    // 达到批量大小时触发分析
    if (this.editBuffer.length >= this.batchSize) {
      this.flushBuffer();
    }

    return fullEdit;
  }

  /**
   * 手动刷新缓冲区
   */
  async flush(): Promise<void> {
    await this.flushBuffer();
  }

  /**
   * 获取缓冲区中的编辑记录
   */
  getBufferedEdits(): UserEdit[] {
    return [...this.editBuffer];
  }

  /**
   * 清空缓冲区
   */
  clearBuffer(): void {
    this.editBuffer = [];
  }

  /**
   * 分析编辑类型
   * 根据原文和修改后文本自动判断编辑类型
   */
  static classifyEdit(original: string, edited: string): EditType {
    const originalTrimmed = original.trim();
    const editedTrimmed = edited.trim();

    // 删除
    if (editedTrimmed.length === 0) {
      return "delete";
    }

    // 添加
    if (originalTrimmed.length === 0) {
      return "add";
    }

    // 计算相似度
    const similarity = EditTracker.calculateSimilarity(originalTrimmed, editedTrimmed);

    // 完全重写（相似度 < 30%）
    if (similarity < 0.3) {
      return "rewrite";
    }

    // 润色（相似度 > 80%，长度变化 < 20%）
    if (similarity > 0.8) {
      const lengthChange = Math.abs(editedTrimmed.length - originalTrimmed.length) / originalTrimmed.length;
      if (lengthChange < 0.2) {
        return "polish";
      }
    }

    // 改写（相似度 30-80%）
    return "rephrase";
  }

  /**
   * 计算两个字符串的相似度（基于最长公共子序列）
   */
  private static calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // 简化的相似度计算：基于共同字符比例
    const aChars = new Set(a.split(""));
    const bChars = new Set(b.split(""));
    const intersection = new Set([...aChars].filter((c) => bChars.has(c)));
    const union = new Set([...aChars, ...bChars]);

    return intersection.size / union.size;
  }

  private async flushBuffer(): Promise<void> {
    if (this.editBuffer.length === 0) return;

    const edits = [...this.editBuffer];
    this.editBuffer = [];

    if (edits.length > 0 && this.onBatchReady) {
      const userId = edits[0].userId;
      const bookId = edits[0].bookId;
      await this.onBatchReady(userId, bookId);
    }
  }

  private generateId(): string {
    return `edit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
