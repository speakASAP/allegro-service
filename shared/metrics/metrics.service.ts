/**
 * Metrics Service
 * Tracks basic counters for API requests and errors
 */

import { Injectable } from '@nestjs/common';

interface Metrics {
  listRequests: number;
  detailRequests: number;
  validationRequests: number;
  errors: number;
  lastResetAt: Date;
}

@Injectable()
export class MetricsService {
  private metrics: Metrics = {
    listRequests: 0,
    detailRequests: 0,
    validationRequests: 0,
    errors: 0,
    lastResetAt: new Date(),
  };

  /**
   * Increment list requests counter
   */
  incrementListRequests(): void {
    this.metrics.listRequests++;
  }

  /**
   * Increment detail requests counter
   */
  incrementDetailRequests(): void {
    this.metrics.detailRequests++;
  }

  /**
   * Increment validation requests counter
   */
  incrementValidationRequests(): void {
    this.metrics.validationRequests++;
  }

  /**
   * Increment errors counter
   */
  incrementErrors(): void {
    this.metrics.errors++;
  }

  /**
   * Get current metrics
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = {
      listRequests: 0,
      detailRequests: 0,
      validationRequests: 0,
      errors: 0,
      lastResetAt: new Date(),
    };
  }
}

