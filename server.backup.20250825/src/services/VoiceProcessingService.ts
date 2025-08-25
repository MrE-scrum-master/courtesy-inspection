// Enhanced Voice Processing Service
// Integrates voice-parser.js template with database storage and business logic
// Supports voice note processing, confidence scoring, and queue management

import { BaseRepository } from '../repositories/BaseRepository';
import { DatabaseService } from '../types/common';

// Import the voice parser from templates
const VoiceParser = require('../../../../templates/voice-parser');

export interface VoiceNote {
  id: string;
  inspection_id: string;
  inspection_item_id?: string;
  original_text: string;
  processed_data: Record<string, any>;
  confidence_score: number;
  audio_file_path?: string;
  audio_duration?: number;
  processed_by: string;
  processed_at: Date;
  recorded_by: string;
  created_at: Date;
}

export interface VoiceProcessingRequest {
  inspectionId: string;
  inspectionItemId?: string;
  originalText: string;
  audioFilePath?: string;
  audioDuration?: number;
  userId: string;
  shopId: string;
}

export interface VoiceProcessingResult {
  success: boolean;
  voiceNote?: VoiceNote;
  parsedData?: {
    component?: string;
    condition?: string;
    measurements?: Record<string, any>;
    action?: string;
    confidence: number;
  };
  suggestions?: string[];
  errors?: string[];
}

export interface VoiceQueueItem {
  id: string;
  priority: 'low' | 'medium' | 'high';
  request: VoiceProcessingRequest;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export class VoiceProcessingService {
  private db: DatabaseService;
  private voiceParser: any;
  private processingQueue: VoiceQueueItem[] = [];
  private isProcessing = false;
  
  constructor(db: DatabaseService) {
    this.db = db;
    this.voiceParser = new VoiceParser();
    
    // Start queue processing
    this.startQueueProcessor();
  }
  
  // Process voice input immediately (for real-time use)
  async processVoiceInput(request: VoiceProcessingRequest): Promise<VoiceProcessingResult> {
    try {
      // Validate request
      const validation = this.validateRequest(request);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }
      
      // Parse voice input
      const parseResult = this.voiceParser.parse(request.originalText);
      
      if (parseResult.error) {
        return { success: false, errors: [parseResult.error] };
      }
      
      // Store voice note in database
      const voiceNote = await this.storeVoiceNote(request, parseResult);
      
      // Generate suggestions
      const suggestions = this.generateSuggestions(parseResult);
      
      // Map parsed data to inspection item format
      const parsedData = {
        component: parseResult.component,
        condition: this.mapStatusToCondition(parseResult.status),
        measurements: parseResult.measurement ? { [parseResult.measurement.unit]: parseResult.measurement.value } : undefined,
        action: parseResult.action,
        confidence: parseResult.confidence
      };
      
      return {
        success: true,
        voiceNote,
        parsedData,
        suggestions
      };
      
    } catch (error) {
      console.error('Voice processing error:', error);
      return { success: false, errors: ['Voice processing failed'] };
    }
  }
  
  // Add voice processing to queue (for large files)
  async queueVoiceProcessing(request: VoiceProcessingRequest, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<string> {
    const queueItem: VoiceQueueItem = {
      id: this.generateId(),
      priority,
      request,
      retryCount: 0,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.processingQueue.push(queueItem);
    this.sortQueue();
    
    return queueItem.id;
  }
  
  // Process batch of voice inputs
  async processBatchVoiceInput(requests: VoiceProcessingRequest[]): Promise<VoiceProcessingResult[]> {
    const results: VoiceProcessingResult[] = [];
    
    for (const request of requests) {
      const result = await this.processVoiceInput(request);
      results.push(result);
    }
    
    return results;
  }
  
  // Get voice notes for inspection
  async getVoiceNotes(inspectionId: string, shopId: string): Promise<VoiceNote[]> {
    const query = `
      SELECT vn.*
      FROM inspection_voice_notes vn
      JOIN inspections i ON vn.inspection_id = i.id
      WHERE vn.inspection_id = $1 AND i.shop_id = $2
      ORDER BY vn.created_at DESC
    `;
    
    const result = await this.db.query(query, [inspectionId, shopId]);
    return result.rows;
  }
  
  // Get voice notes for specific inspection item
  async getVoiceNotesForItem(inspectionItemId: string, shopId: string): Promise<VoiceNote[]> {
    const query = `
      SELECT vn.*
      FROM inspection_voice_notes vn
      JOIN inspection_items ii ON vn.inspection_item_id = ii.id
      JOIN inspections i ON ii.inspection_id = i.id
      WHERE vn.inspection_item_id = $1 AND i.shop_id = $2
      ORDER BY vn.created_at DESC
    `;
    
    const result = await this.db.query(query, [inspectionItemId, shopId]);
    return result.rows;
  }
  
  // Update voice note
  async updateVoiceNote(
    id: string, 
    processedData: Record<string, any>, 
    confidenceScore: number,
    shopId: string
  ): Promise<boolean> {
    
    const query = `
      UPDATE inspection_voice_notes vn
      SET processed_data = $2,
          confidence_score = $3,
          processed_at = NOW()
      FROM inspections i
      WHERE vn.inspection_id = i.id 
        AND vn.id = $1 
        AND i.shop_id = $4
    `;
    
    const result = await this.db.query(query, [id, JSON.stringify(processedData), confidenceScore, shopId]);
    return result.rowCount > 0;
  }
  
  // Delete voice note
  async deleteVoiceNote(id: string, shopId: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get voice note info for cleanup
      const voiceNoteQuery = `
        SELECT vn.audio_file_path
        FROM inspection_voice_notes vn
        JOIN inspections i ON vn.inspection_id = i.id
        WHERE vn.id = $1 AND i.shop_id = $2
      `;
      
      const voiceNoteResult = await client.query(voiceNoteQuery, [id, shopId]);
      
      if (voiceNoteResult.rows.length === 0) {
        return false;
      }
      
      // Delete from database
      const deleteQuery = `
        DELETE FROM inspection_voice_notes vn
        USING inspections i
        WHERE vn.inspection_id = i.id 
          AND vn.id = $1 
          AND i.shop_id = $2
      `;
      
      const deleteResult = await client.query(deleteQuery, [id, shopId]);
      await client.query('COMMIT');
      
      // TODO: Delete audio file if exists
      const audioFilePath = voiceNoteResult.rows[0].audio_file_path;
      if (audioFilePath) {
        // File cleanup would be handled here
        console.log(`Audio file cleanup needed: ${audioFilePath}`);
      }
      
      return deleteResult.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get voice processing statistics
  async getProcessingStatistics(shopId: string, days: number = 30): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_voice_notes,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN confidence_score >= 0.8 THEN 1 END) as high_confidence_count,
        COUNT(CASE WHEN confidence_score < 0.5 THEN 1 END) as low_confidence_count,
        COUNT(CASE WHEN audio_file_path IS NOT NULL THEN 1 END) as notes_with_audio,
        AVG(audio_duration) as avg_audio_duration,
        (SELECT jsonb_object_agg(component, component_count)
         FROM (
           SELECT (processed_data->>'component') as component, 
                  COUNT(*) as component_count
           FROM inspection_voice_notes vn2
           JOIN inspections i2 ON vn2.inspection_id = i2.id
           WHERE i2.shop_id = $1 
             AND vn2.created_at >= NOW() - INTERVAL '${days} days'
             AND processed_data->>'component' IS NOT NULL
           GROUP BY processed_data->>'component'
           ORDER BY component_count DESC
           LIMIT 10
         ) component_stats
        ) as most_common_components
      FROM inspection_voice_notes vn
      JOIN inspections i ON vn.inspection_id = i.id
      WHERE i.shop_id = $1 
        AND vn.created_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const result = await this.db.query(query, [shopId]);
    return result.rows[0];
  }
  
  // Get queue status
  getQueueStatus(): { pending: number; processing: number; failed: number } {
    return {
      pending: this.processingQueue.filter(item => item.status === 'pending').length,
      processing: this.processingQueue.filter(item => item.status === 'processing').length,
      failed: this.processingQueue.filter(item => item.status === 'failed').length
    };
  }
  
  // Reprocess failed items
  async reprocessFailedItems(): Promise<void> {
    const failedItems = this.processingQueue.filter(item => item.status === 'failed' && item.retryCount < 3);
    
    for (const item of failedItems) {
      item.status = 'pending';
      item.retryCount++;
    }
    
    this.sortQueue();
  }
  
  // Clear completed queue items
  clearCompletedItems(): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24); // Keep completed items for 24 hours
    
    this.processingQueue = this.processingQueue.filter(
      item => item.status !== 'completed' || item.processedAt! > cutoffTime
    );
  }
  
  // Private methods
  
  private validateRequest(request: VoiceProcessingRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!request.inspectionId) {
      errors.push('Inspection ID is required');
    }
    
    if (!request.originalText || request.originalText.trim().length === 0) {
      errors.push('Original text is required');
    }
    
    if (request.originalText && request.originalText.length > 5000) {
      errors.push('Text too long (maximum 5000 characters)');
    }
    
    if (!request.userId) {
      errors.push('User ID is required');
    }
    
    if (!request.shopId) {
      errors.push('Shop ID is required');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private async storeVoiceNote(request: VoiceProcessingRequest, parseResult: any): Promise<VoiceNote> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verify inspection exists and belongs to shop
      const inspectionCheck = await client.query(
        'SELECT id FROM inspections WHERE id = $1 AND shop_id = $2',
        [request.inspectionId, request.shopId]
      );
      
      if (inspectionCheck.rows.length === 0) {
        throw new Error('Inspection not found or access denied');
      }
      
      // Verify inspection item if provided
      if (request.inspectionItemId) {
        const itemCheck = await client.query(
          'SELECT id FROM inspection_items WHERE id = $1 AND inspection_id = $2',
          [request.inspectionItemId, request.inspectionId]
        );
        
        if (itemCheck.rows.length === 0) {
          throw new Error('Inspection item not found');
        }
      }
      
      const query = `
        INSERT INTO inspection_voice_notes (
          inspection_id, inspection_item_id, original_text,
          processed_data, confidence_score, audio_file_path,
          audio_duration, processed_by, recorded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        request.inspectionId,
        request.inspectionItemId,
        request.originalText,
        JSON.stringify(parseResult),
        parseResult.confidence,
        request.audioFilePath,
        request.audioDuration,
        'voice-parser-service',
        request.userId
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  private generateSuggestions(parseResult: any): string[] {
    const suggestions: string[] = [];
    
    // Confidence-based suggestions
    if (parseResult.confidence < 0.7) {
      suggestions.push('Low confidence parsing - consider rephrasing or adding more detail');
      
      if (!parseResult.component) {
        suggestions.push('Try including specific automotive parts (brakes, tires, engine, etc.)');
      }
      
      if (!parseResult.status) {
        suggestions.push('Include condition words like "good", "worn", "poor", or "needs replacement"');
      }
      
      if (!parseResult.measurement) {
        suggestions.push('Add specific measurements (thickness in mm, pressure in PSI, etc.)');
      }
    }
    
    // Component-specific suggestions
    if (parseResult.component) {
      const componentSuggestions = this.getComponentSpecificSuggestions(parseResult.component);
      suggestions.push(...componentSuggestions);
    }
    
    // Measurement validation suggestions
    if (parseResult.measurement) {
      const measurementSuggestion = this.validateMeasurement(parseResult.measurement, parseResult.component);
      if (measurementSuggestion) {
        suggestions.push(measurementSuggestion);
      }
    }
    
    // High confidence acknowledgment
    if (parseResult.confidence >= 0.8) {
      suggestions.push('High confidence parsing - input looks comprehensive!');
    }
    
    return suggestions;
  }
  
  private getComponentSpecificSuggestions(component: string): string[] {
    const suggestions: string[] = [];
    
    if (component.includes('brake')) {
      suggestions.push('For brakes, consider mentioning pad thickness (mm) and rotor condition');
    } else if (component.includes('tire')) {
      suggestions.push('For tires, include tread depth (32nds or mm) and pressure (PSI)');
    } else if (component.includes('oil')) {
      suggestions.push('For oil, mention level, color, and viscosity if visible');
    } else if (component.includes('battery')) {
      suggestions.push('For battery, include voltage reading and terminal condition');
    } else if (component.includes('filter')) {
      suggestions.push('For filters, describe dirt level and restriction');
    }
    
    return suggestions;
  }
  
  private validateMeasurement(measurement: any, component?: string): string | null {
    if (!measurement || !measurement.value) {
      return null;
    }
    
    const value = measurement.value;
    const unit = measurement.unit;
    
    // Brake pad thickness validation
    if (component?.includes('brake') && component?.includes('pad')) {
      if (unit === 'mm' && value < 3) {
        return 'Warning: Brake pad thickness below 3mm indicates immediate replacement needed';
      }
      if (unit === 'mm' && value < 5) {
        return 'Caution: Brake pad thickness below 5mm - monitor closely';
      }
    }
    
    // Tire tread depth validation
    if (component?.includes('tire')) {
      if (unit === '32nds' && value < 4) {
        return 'Warning: Tire tread depth below 4/32" indicates replacement needed';
      }
      if (unit === 'mm' && value < 3) {
        return 'Warning: Tire tread depth below 3mm indicates replacement needed';
      }
    }
    
    // Battery voltage validation
    if (component?.includes('battery') && unit === 'volts') {
      if (value < 12.0) {
        return 'Warning: Battery voltage below 12V indicates potential battery issues';
      }
      if (value > 14.5) {
        return 'Caution: Battery voltage above 14.5V may indicate overcharging';
      }
    }
    
    return null;
  }
  
  private mapStatusToCondition(status: string | null): 'good' | 'fair' | 'poor' | 'needs_immediate' | undefined {
    if (!status) return undefined;
    
    const statusMap: Record<string, 'good' | 'fair' | 'poor' | 'needs_immediate'> = {
      'green': 'good',
      'good': 'good',
      'excellent': 'good',
      'yellow': 'fair',
      'worn': 'fair',
      'marginal': 'fair',
      'fair': 'fair',
      'red': 'poor',
      'bad': 'poor',
      'poor': 'poor',
      'critical': 'needs_immediate',
      'urgent': 'needs_immediate',
      'needs_immediate': 'needs_immediate'
    };
    
    return statusMap[status.toLowerCase()];
  }
  
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processQueue();
      }
    }, 5000); // Check queue every 5 seconds
    
    // Cleanup completed items every hour
    setInterval(() => {
      this.clearCompletedItems();
    }, 3600000);
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const pendingItems = this.processingQueue
        .filter(item => item.status === 'pending')
        .sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority))
        .slice(0, 5); // Process up to 5 items at once
      
      for (const item of pendingItems) {
        try {
          item.status = 'processing';
          const result = await this.processVoiceInput(item.request);
          
          if (result.success) {
            item.status = 'completed';
            item.processedAt = new Date();
          } else {
            item.status = 'failed';
            item.error = result.errors?.join(', ') || 'Unknown error';
            item.retryCount++;
          }
        } catch (error) {
          item.status = 'failed';
          item.error = error instanceof Error ? error.message : 'Processing error';
          item.retryCount++;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  private sortQueue(): void {
    this.processingQueue.sort((a, b) => {
      // First by status (pending first)
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      
      // Then by priority
      const priorityDiff = this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Finally by creation time
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
  
  private getPriorityValue(priority: 'low' | 'medium' | 'high'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
  
  private generateId(): string {
    return `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}