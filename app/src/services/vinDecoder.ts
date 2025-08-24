// VIN Decoder Service using NHTSA API (no API key needed!)
// https://vpic.nhtsa.dot.gov/api/

interface NHTSAResult {
  Value: string | null;
  ValueId: string | null;
  Variable: string;
  VariableId: number;
}

interface NHTSAResponse {
  Count: number;
  Message: string;
  SearchCriteria: string;
  Results: NHTSAResult[];
}

export interface VehicleData {
  vin: string;
  make: string;
  model: string;
  year: number;
  bodyClass?: string;
  vehicleType?: string;
  doors?: number;
  driveType?: string;
  engineCylinders?: number;
  fuelType?: string;
  trim?: string;
  series?: string;
  manufacturerName?: string;
  errorCode?: string;
  errorText?: string;
}

export class VINDecoder {
  private static readonly NHTSA_API_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';
  
  /**
   * Decode a VIN using NHTSA's free API
   * @param vin The Vehicle Identification Number to decode
   * @returns Decoded vehicle information
   */
  static async decode(vin: string): Promise<VehicleData | null> {
    try {
      // Validate VIN format (17 characters)
      if (!vin || vin.length !== 17) {
        throw new Error('VIN must be exactly 17 characters');
      }

      // Call NHTSA API
      const response = await fetch(
        `${this.NHTSA_API_URL}/decodevin/${vin}?format=json`
      );

      if (!response.ok) {
        throw new Error(`NHTSA API error: ${response.status}`);
      }

      const data: NHTSAResponse = await response.json();
      
      // Parse the results into a more usable format
      const vehicleData = this.parseNHTSAResponse(vin, data);
      
      return vehicleData;
    } catch (error) {
      console.error('VIN decode error:', error);
      return null;
    }
  }

  /**
   * Parse NHTSA response into our VehicleData format
   */
  private static parseNHTSAResponse(vin: string, response: NHTSAResponse): VehicleData {
    const results: { [key: string]: string | null } = {};
    
    // Convert array of results to key-value object
    response.Results.forEach(result => {
      results[result.Variable] = result.Value;
    });

    // Extract and clean the data
    const vehicleData: VehicleData = {
      vin,
      make: results['Make'] || 'Unknown',
      model: results['Model'] || 'Unknown',
      year: parseInt(results['Model Year'] || '0') || new Date().getFullYear(),
      bodyClass: results['Body Class'] || undefined,
      vehicleType: results['Vehicle Type'] || undefined,
      doors: results['Doors'] ? parseInt(results['Doors']) : undefined,
      driveType: results['Drive Type'] || undefined,
      engineCylinders: results['Engine Number of Cylinders'] 
        ? parseInt(results['Engine Number of Cylinders']) 
        : undefined,
      fuelType: results['Fuel Type - Primary'] || undefined,
      trim: results['Trim'] || undefined,
      series: results['Series'] || undefined,
      manufacturerName: results['Manufacturer Name'] || undefined,
      errorCode: results['Error Code'] || undefined,
      errorText: results['Error Text'] || undefined,
    };

    // Clean up unknown/null values
    Object.keys(vehicleData).forEach(key => {
      const value = vehicleData[key as keyof VehicleData];
      if (value === null || value === '' || value === 'Not Applicable') {
        delete vehicleData[key as keyof VehicleData];
      }
    });

    return vehicleData;
  }

  /**
   * Validate VIN checksum (basic validation)
   */
  static isValidVIN(vin: string): boolean {
    if (!vin || vin.length !== 17) return false;
    
    // Basic regex check (alphanumeric, no I, O, Q)
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    return vinRegex.test(vin.toUpperCase());
  }

  /**
   * Format vehicle display name
   */
  static formatVehicleName(vehicle: VehicleData): string {
    const parts = [];
    
    if (vehicle.year && vehicle.year > 1900) {
      parts.push(vehicle.year);
    }
    
    if (vehicle.make && vehicle.make !== 'Unknown') {
      parts.push(vehicle.make);
    }
    
    if (vehicle.model && vehicle.model !== 'Unknown') {
      parts.push(vehicle.model);
    }
    
    if (vehicle.trim) {
      parts.push(vehicle.trim);
    }
    
    return parts.join(' ') || 'Unknown Vehicle';
  }
}

export default VINDecoder;