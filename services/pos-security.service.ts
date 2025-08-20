import { Injectable } from '@angular/core';
import { POS_Order } from '../interface.model';

export interface RetryConfig {
  maxRetries: number;
  retryDelays: number[];
  backoffMultiplier: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  successCount: number;
}

export interface OperationStats {
  totalAttempts: number;
  failures: number;
  successes: number;
  averageResponseTime: number;
  lastResponseTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class POSSecurityService {
  private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    retryDelays: [1000, 2000, 4000],
    backoffMultiplier: 2
  };

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // failures
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly HALF_OPEN_MAX_CALLS = 3;

  // Circuit breaker states by operation type
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  
  // Operation statistics
  private operationStats = new Map<string, OperationStats>();
  
  // Encryption key (session-based)
  private encryptionKey: string = '';
  
  // Error tracking
  private errorLog: Array<{ type: string; error: any; timestamp: number; operation: string }> = [];
  private readonly MAX_ERROR_LOG_SIZE = 1000;

  constructor() {
    this.initializeEncryptionKey();
  }

  // ========================
  // RETRY MECHANISMS
  // ========================

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>, 
    operationType: string,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config };
    const startTime = Date.now();
    
    // Check circuit breaker
    if (!this.canExecuteOperation(operationType)) {
      throw new Error(`Circuit breaker OPEN for operation: ${operationType}`);
    }

    let lastError: any;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Record success
        this.recordOperationSuccess(operationType, Date.now() - startTime);
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Record failure
        this.recordOperationFailure(operationType, error, Date.now() - startTime);
        
        // Don't retry on last attempt
        if (attempt === retryConfig.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateRetryDelay(attempt, retryConfig);
        console.warn(`⚠️ Operation ${operationType} failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error);
        
        await this.delay(delay);
      }
    }
    
    throw new Error(`Operation ${operationType} failed after ${retryConfig.maxRetries + 1} attempts. Last error: ${lastError?.message || 'Unknown'}`);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    if (attempt < config.retryDelays.length) {
      return config.retryDelays[attempt];
    }
    
    // Exponential backoff for attempts beyond predefined delays
    const baseDelay = config.retryDelays[config.retryDelays.length - 1];
    return baseDelay * Math.pow(config.backoffMultiplier, attempt - config.retryDelays.length + 1);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================
  // CIRCUIT BREAKER
  // ========================

  /**
   * Check if operation can be executed based on circuit breaker state
   */
  private canExecuteOperation(operationType: string): boolean {
    const breaker = this.getCircuitBreaker(operationType);
    const now = Date.now();
    
    switch (breaker.state) {
      case 'CLOSED':
        return true;
        
      case 'OPEN':
        if (now - breaker.lastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
          // Transition to HALF_OPEN
          breaker.state = 'HALF_OPEN';
          breaker.successCount = 0;
          console.log(`🔄 Circuit breaker for ${operationType} transitioned to HALF_OPEN`);
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        return breaker.successCount < this.HALF_OPEN_MAX_CALLS;
        
      default:
        return true;
    }
  }

  /**
   * Get or create circuit breaker for operation type
   */
  private getCircuitBreaker(operationType: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(operationType)) {
      this.circuitBreakers.set(operationType, {
        failures: 0,
        lastFailure: 0,
        state: 'CLOSED',
        successCount: 0
      });
    }
    return this.circuitBreakers.get(operationType)!;
  }

  /**
   * Record successful operation
   */
  private recordOperationSuccess(operationType: string, responseTime: number): void {
    const breaker = this.getCircuitBreaker(operationType);
    const stats = this.getOperationStats(operationType);
    
    // Update circuit breaker
    breaker.successCount++;
    if (breaker.state === 'HALF_OPEN' && breaker.successCount >= this.HALF_OPEN_MAX_CALLS) {
      breaker.state = 'CLOSED';
      breaker.failures = 0;
      console.log(`✅ Circuit breaker for ${operationType} transitioned to CLOSED`);
    }
    
    // Update statistics
    stats.successes++;
    stats.totalAttempts++;
    stats.lastResponseTime = responseTime;
    stats.averageResponseTime = (stats.averageResponseTime * (stats.totalAttempts - 1) + responseTime) / stats.totalAttempts;
  }

  /**
   * Record failed operation
   */
  private recordOperationFailure(operationType: string, error: any, responseTime: number): void {
    const breaker = this.getCircuitBreaker(operationType);
    const stats = this.getOperationStats(operationType);
    
    // Update circuit breaker
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'OPEN';
      console.error(`🚨 Circuit breaker for ${operationType} OPENED after ${breaker.failures} failures`);
    }
    
    // Update statistics
    stats.failures++;
    stats.totalAttempts++;
    stats.lastResponseTime = responseTime;
    stats.averageResponseTime = (stats.averageResponseTime * (stats.totalAttempts - 1) + responseTime) / stats.totalAttempts;
    
    // Log error
    this.logError(operationType, error);
  }

  /**
   * Get or create operation statistics
   */
  private getOperationStats(operationType: string): OperationStats {
    if (!this.operationStats.has(operationType)) {
      this.operationStats.set(operationType, {
        totalAttempts: 0,
        failures: 0,
        successes: 0,
        averageResponseTime: 0,
        lastResponseTime: 0
      });
    }
    return this.operationStats.get(operationType)!;
  }

  // ========================
  // DATA ENCRYPTION
  // ========================

  /**
   * Initialize session-based encryption key
   */
  private initializeEncryptionKey(): void {
    // Generate session key based on timestamp and random values
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    this.encryptionKey = btoa(timestamp + random).substring(0, 32);
  }

  /**
   * Encrypt sensitive order data
   */
  async encryptSensitiveData(order: POS_Order): Promise<POS_Order> {
    try {
      const encryptedOrder = { ...order };
      
      // Identify and encrypt sensitive fields
      if (order.Remark && this.containsSensitiveInfo(order.Remark)) {
        encryptedOrder.Remark = await this.encrypt(order.Remark);
      }
      
      if (order.DiscountFromSalesman && order.DiscountFromSalesman > 0) {
        // Don't encrypt discount amount, but mask it in logs
        encryptedOrder.DiscountFromSalesman = order.DiscountFromSalesman;
      }
      
      return encryptedOrder;
    } catch (error) {
      console.error('❌ Failed to encrypt sensitive data:', error);
      return order; // Return original if encryption fails
    }
  }

  /**
   * Decrypt sensitive order data
   */
  async decryptSensitiveData(encryptedData: string): Promise<any> {
    try {
      return await this.decrypt(encryptedData);
    } catch (error) {
      console.error('❌ Failed to decrypt data:', error);
      return null;
    }
  }

  /**
   * Basic encryption (for demo purposes - use proper crypto in production)
   */
  private async encrypt(data: string): Promise<string> {
    // Simple XOR encryption for demo (replace with proper encryption)
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(
        data.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
      );
    }
    return btoa(encrypted);
  }

  /**
   * Basic decryption
   */
  private async decrypt(encryptedData: string): Promise<string> {
    try {
      const data = atob(encryptedData);
      let decrypted = '';
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(
          data.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length)
        );
      }
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  /**
   * Check if text contains sensitive information
   */
  private containsSensitiveInfo(text: string): boolean {
    const sensitivePatterns = [
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Credit card pattern
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/, // Phone number
      /password|secret|key|token/i // Common sensitive keywords
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(text));
  }

  // ========================
  // ERROR TRACKING & MONITORING
  // ========================

  /**
   * Log error with context
   */
  private logError(operation: string, error: any): void {
    const errorEntry = {
      type: error.constructor.name || 'UnknownError',
      error: {
        message: error.message || 'Unknown error',
        stack: error.stack?.substring(0, 500) || 'No stack trace'
      },
      timestamp: Date.now(),
      operation
    };
    
    this.errorLog.push(errorEntry);
    
    // Limit log size
    if (this.errorLog.length > this.MAX_ERROR_LOG_SIZE) {
      this.errorLog = this.errorLog.slice(-this.MAX_ERROR_LOG_SIZE);
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Array<{ operation: string; state: string; failures: number; lastFailure: number }> {
    const status = [];
    for (const [operation, breaker] of this.circuitBreakers.entries()) {
      status.push({
        operation,
        state: breaker.state,
        failures: breaker.failures,
        lastFailure: breaker.lastFailure
      });
    }
    return status;
  }

  /**
   * Get all operation statistics for monitoring
   */
  getAllOperationStats(): Array<{ operation: string; stats: OperationStats }> {
    const stats = [];
    for (const [operation, operationStats] of this.operationStats.entries()) {
      stats.push({
        operation,
        stats: operationStats
      });
    }
    return stats;
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 50): Array<{ type: string; error: any; timestamp: number; operation: string }> {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error statistics (for testing)
   */
  clearStats(): void {
    this.circuitBreakers.clear();
    this.operationStats.clear();
    this.errorLog = [];
  }
}
