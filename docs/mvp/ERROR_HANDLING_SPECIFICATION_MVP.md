# ERROR HANDLING - MVP VERSION

**Philosophy**: "Fail gracefully, log simply, recover manually"

**Version 1.0 MVP | December 2024**

---

## Executive Summary

This document defines a simplified error handling strategy for the MVP version of the Courtesy Inspection platform. The approach prioritizes basic error management with simple try/catch blocks, console logging, and manual recovery methods while maintaining user-friendly error messages.

**Core MVP Principles:**
- **Simple Logging**: Console.error for basic error tracking
- **Manual Recovery**: User-driven error resolution
- **Basic Messages**: Clear, non-technical error messages
- **Graceful Degradation**: Simple fallbacks without complex retry logic

---

## 1. Error Taxonomy and Classification

### 1.1 Basic Error Categories

```yaml
error_categories:
  user_errors:
    examples:
      - invalid_input
      - permission_denied
      - resource_not_found
    recovery: show_message_to_user
    
  system_errors:
    examples:
      - database_error
      - network_error
      - service_unavailable
    recovery: show_error_and_retry_button
    
  validation_errors:
    examples:
      - required_field_missing
      - invalid_format
      - constraint_violation
    recovery: highlight_field_and_show_message
```

### 1.2 Simple Error Codes

```typescript
enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VOICE_FAILED = 'VOICE_FAILED'
}

interface SimpleError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  timestamp: Date;
}
```

---

## 2. Mobile App Error Handling

### 2.1 Basic Network Error Handling

```typescript
class SimpleNetworkErrorHandler {
  async handleRequest(url: string, options: RequestOptions): Promise<any> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`Network error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Network request failed:', error);
      
      // Simple user notification
      this.showUserError('Connection problem. Please check your internet and try again.');
      
      throw new SimpleError({
        code: ErrorCode.NETWORK_ERROR,
        message: error.message,
        userMessage: 'Connection problem. Please try again.',
        timestamp: new Date()
      });
    }
  }
  
  private showUserError(message: string): void {
    // Simple alert or toast notification
    alert(message);
  }
}
```

### 2.2 Basic Offline Handling

```typescript
class SimpleOfflineHandler {
  private isOnline = navigator.onLine;
  
  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showMessage('Connection restored');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showMessage('Working offline - changes will sync when connection returns');
    });
  }
  
  async saveData(data: any): Promise<void> {
    if (this.isOnline) {
      try {
        await this.saveToServer(data);
      } catch (error) {
        console.error('Save failed:', error);
        this.saveLocally(data);
        this.showMessage('Saved locally. Will sync when connection improves.');
      }
    } else {
      this.saveLocally(data);
      this.showMessage('Saved offline. Will sync when connection returns.');
    }
  }
  
  private saveLocally(data: any): void {
    // Simple localStorage save
    const saved = JSON.parse(localStorage.getItem('offlineData') || '[]');
    saved.push({ ...data, timestamp: new Date().toISOString() });
    localStorage.setItem('offlineData', JSON.stringify(saved));
  }
  
  private showMessage(message: string): void {
    // Simple user notification
    console.log(message);
    // In real app: show toast or banner
  }
}
```

### 2.3 Basic Voice Recognition Error Handling

```typescript
class SimpleVoiceErrorHandler {
  async handleVoiceInput(): Promise<string | null> {
    try {
      const result = await this.startVoiceRecognition();
      return result;
    } catch (error) {
      console.error('Voice recognition failed:', error);
      
      // Simple fallback to manual input
      this.showVoiceError();
      return null;
    }
  }
  
  private showVoiceError(): void {
    const shouldRetry = confirm('Voice recognition failed. Try again?');
    
    if (shouldRetry) {
      this.handleVoiceInput();
    } else {
      this.showManualInput();
    }
  }
  
  private showManualInput(): void {
    // Show text input field
    const input = prompt('Please type your input:');
    if (input) {
      this.processInput(input);
    }
  }
}
```

---

## 3. Web Interface Error Handling

### 3.1 Simple Form Validation

```typescript
class SimpleFormValidator {
  validateForm(formData: FormData): ValidationResult {
    const errors: FieldError[] = [];
    
    // Basic required field validation
    if (!formData.get('customerName')) {
      errors.push({
        field: 'customerName',
        message: 'Customer name is required'
      });
    }
    
    // Basic email validation
    const email = formData.get('email')?.toString();
    if (email && !this.isValidEmail(email)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address'
      });
    }
    
    // Basic VIN validation
    const vin = formData.get('vin')?.toString();
    if (vin && vin.length !== 17) {
      errors.push({
        field: 'vin',
        message: 'VIN must be exactly 17 characters'
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
  
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  showFieldErrors(errors: FieldError[]): void {
    errors.forEach(error => {
      const field = document.getElementById(error.field);
      if (field) {
        field.classList.add('error');
        
        // Show error message
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = error.message;
        field.parentNode?.insertBefore(errorElement, field.nextSibling);
      }
    });
  }
}

interface FieldError {
  field: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: FieldError[];
}
```

### 3.2 Simple Error Display

```typescript
class SimpleErrorDisplay {
  showError(error: SimpleError): void {
    // Remove existing error messages
    this.clearErrors();
    
    // Create error banner
    const errorBanner = document.createElement('div');
    errorBanner.className = 'error-banner';
    errorBanner.innerHTML = `
      <div class="error-content">
        <span class="error-message">${error.userMessage}</span>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    // Insert at top of page
    document.body.insertBefore(errorBanner, document.body.firstChild);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      errorBanner.remove();
    }, 10000);
  }
  
  private clearErrors(): void {
    const existingErrors = document.querySelectorAll('.error-banner');
    existingErrors.forEach(error => error.remove());
  }
}
```

---

## 4. API Error Handling

### 4.1 Simple API Error Responses

```typescript
interface SimpleAPIError {
  error: string;
  message: string;
  timestamp: string;
}

class SimpleAPIErrorHandler {
  handleError(error: Error, req: any, res: any): void {
    console.error('API Error:', error.message, error.stack);
    
    // Simple error response
    const response: SimpleAPIError = {
      error: this.getErrorType(error),
      message: this.getUserMessage(error),
      timestamp: new Date().toISOString()
    };
    
    const statusCode = this.getStatusCode(error);
    res.status(statusCode).json(response);
  }
  
  private getErrorType(error: Error): string {
    if (error.name === 'ValidationError') return 'VALIDATION_FAILED';
    if (error.name === 'NotFoundError') return 'NOT_FOUND';
    if (error.name === 'UnauthorizedError') return 'PERMISSION_DENIED';
    return 'SERVER_ERROR';
  }
  
  private getUserMessage(error: Error): string {
    const messages = {
      ValidationError: 'Please check your information and try again',
      NotFoundError: 'The requested item was not found',
      UnauthorizedError: 'You do not have permission to perform this action',
      default: 'Something went wrong. Please try again.'
    };
    
    return messages[error.name as keyof typeof messages] || messages.default;
  }
  
  private getStatusCode(error: Error): number {
    const statusCodes = {
      ValidationError: 400,
      UnauthorizedError: 403,
      NotFoundError: 404,
      default: 500
    };
    
    return statusCodes[error.name as keyof typeof statusCodes] || statusCodes.default;
  }
}
```

---

## 5. Database Error Handling

### 5.1 Simple Database Error Management

```typescript
class SimpleDatabaseHandler {
  async executeQuery(query: string, params: any[]): Promise<any> {
    try {
      const result = await this.database.query(query, params);
      return result;
    } catch (error) {
      console.error('Database error:', error.message);
      
      // Simple error categorization
      if (error.code === '23505') {
        throw new Error('DUPLICATE_ENTRY');
      }
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('DATABASE_UNAVAILABLE');
      }
      
      throw new Error('DATABASE_ERROR');
    }
  }
  
  async createInspection(data: any): Promise<any> {
    try {
      return await this.executeQuery(
        'INSERT INTO inspections (vin, customer_id, status) VALUES ($1, $2, $3)',
        [data.vin, data.customerId, 'pending']
      );
    } catch (error) {
      if (error.message === 'DUPLICATE_ENTRY') {
        throw new SimpleError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Inspection with this VIN already exists',
          userMessage: 'An inspection for this vehicle already exists',
          timestamp: new Date()
        });
      }
      
      throw error;
    }
  }
}
```

---

## 6. SMS Error Handling

### 6.1 Simple SMS Error Management

```typescript
class SimpleSMSHandler {
  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const result = await this.smsService.send(phoneNumber, message);
      return result.success;
    } catch (error) {
      console.error('SMS failed:', error.message);
      
      // Simple fallback: log for manual follow-up
      this.logFailedSMS(phoneNumber, message, error.message);
      
      return false;
    }
  }
  
  private logFailedSMS(phone: string, message: string, error: string): void {
    console.log('Failed SMS logged for manual follow-up:', {
      phone,
      message,
      error,
      timestamp: new Date().toISOString()
    });
    
    // In real implementation: save to database for admin review
  }
}
```

---

## 7. Error Logging

### 7.1 Simple Console Logging

```typescript
class SimpleLogger {
  logError(error: Error, context?: any): void {
    const logData = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context: context || {}
    };
    
    console.error('Application Error:', logData);
  }
  
  logUserAction(action: string, data?: any): void {
    console.log('User Action:', {
      timestamp: new Date().toISOString(),
      action,
      data: data || {}
    });
  }
  
  logNetworkError(url: string, error: Error): void {
    console.error('Network Error:', {
      timestamp: new Date().toISOString(),
      url,
      error: error.message
    });
  }
}
```

---

## 8. User-Friendly Messages

### 8.1 Simple Message Templates

```typescript
class SimpleMessageProvider {
  getErrorMessage(errorCode: ErrorCode): string {
    const messages = {
      [ErrorCode.VALIDATION_FAILED]: 'Please check your information and try again',
      [ErrorCode.NETWORK_ERROR]: 'Connection problem. Please check your internet and try again',
      [ErrorCode.SERVER_ERROR]: 'Something went wrong. Please try again in a moment',
      [ErrorCode.NOT_FOUND]: 'The item you\'re looking for was not found',
      [ErrorCode.PERMISSION_DENIED]: 'You don\'t have permission to do that',
      [ErrorCode.VOICE_FAILED]: 'Voice recognition failed. Try typing instead'
    };
    
    return messages[errorCode] || 'An unexpected error occurred';
  }
  
  getRetryMessage(): string {
    return 'Try again';
  }
  
  getHelpMessage(errorCode: ErrorCode): string {
    const helpMessages = {
      [ErrorCode.VOICE_FAILED]: 'Tap the keyboard icon to type instead',
      [ErrorCode.NETWORK_ERROR]: 'Check your internet connection and try again',
      [ErrorCode.VALIDATION_FAILED]: 'Make sure all required fields are filled out correctly'
    };
    
    return helpMessages[errorCode] || 'Contact support if this problem continues';
  }
}
```

---

## 9. Basic Recovery Strategies

### 9.1 Simple Manual Recovery

```typescript
class SimpleRecoveryManager {
  handleError(error: SimpleError): void {
    // Log the error
    console.error('Error occurred:', error);
    
    // Show user-friendly message
    this.showErrorToUser(error);
    
    // Provide simple recovery options
    this.showRecoveryOptions(error);
  }
  
  private showErrorToUser(error: SimpleError): void {
    alert(error.userMessage);
  }
  
  private showRecoveryOptions(error: SimpleError): void {
    const shouldRetry = confirm('Would you like to try again?');
    
    if (shouldRetry) {
      // Simple retry - reload page or retry last action
      window.location.reload();
    }
  }
  
  // Simple offline data recovery
  recoverOfflineData(): any[] {
    try {
      const saved = localStorage.getItem('offlineData');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Could not recover offline data:', error);
      return [];
    }
  }
}
```

---

## 10. Testing Basic Error Scenarios

### 10.1 Simple Error Testing

```typescript
// Simple test examples
describe('Basic Error Handling', () => {
  it('should show user-friendly message for network errors', async () => {
    const handler = new SimpleNetworkErrorHandler();
    
    // Mock network failure
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failed'));
    
    try {
      await handler.handleRequest('/api/test', {});
    } catch (error) {
      expect(error.userMessage).toBe('Connection problem. Please try again.');
    }
  });
  
  it('should validate required fields', () => {
    const validator = new SimpleFormValidator();
    
    const formData = new FormData();
    // Don't add required customerName
    
    const result = validator.validateForm(formData);
    
    expect(result.isValid).toBe(false);
    expect(result.errors[0].field).toBe('customerName');
  });
  
  it('should handle voice recognition failure', async () => {
    const voiceHandler = new SimpleVoiceErrorHandler();
    
    // Mock voice recognition failure
    voiceHandler.startVoiceRecognition = jest.fn().mockRejectedValue(new Error('No speech'));
    
    const result = await voiceHandler.handleVoiceInput();
    
    expect(result).toBeNull();
  });
});
```

---

## Implementation Guidelines

### MVP Best Practices

1. **Keep It Simple**: Use basic try/catch blocks with console.error logging
2. **User-First**: Always show clear, non-technical error messages
3. **Manual Recovery**: Let users retry or reload rather than complex auto-recovery
4. **Basic Validation**: Focus on required fields and basic format checking
5. **Offline Awareness**: Simple localStorage for offline data
6. **No External Services**: Avoid Sentry or complex monitoring in MVP

### Quick Implementation Checklist

- [ ] Add try/catch blocks to all async functions
- [ ] Replace technical error messages with user-friendly ones
- [ ] Add basic form validation for required fields
- [ ] Implement simple offline data storage
- [ ] Add console.error logging for all errors
- [ ] Create simple error display components
- [ ] Add basic retry buttons for failed actions

---

## Conclusion

This MVP error handling approach provides a solid foundation for the Courtesy Inspection platform while keeping complexity low. The focus is on user experience with simple, clear error messages and basic recovery mechanisms.

**MVP Implementation Priority:**
1. Basic try/catch error handling
2. User-friendly error messages
3. Simple form validation
4. Basic offline data storage
5. Console logging for debugging

**Success Metrics for MVP:**
- All errors show user-friendly messages
- No application crashes from unhandled errors
- Basic offline functionality works
- Users can manually recover from common errors

---

**Document Version**: 1.0 MVP  
**Last Updated**: December 2024  
**Next Review**: After MVP completion