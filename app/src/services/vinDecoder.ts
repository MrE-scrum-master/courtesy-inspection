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
    console.log('🏎️ VINDecoder.decode() CALLED');
    console.log('🏎️ Input VIN:', vin);
    
    try {
      // Validate VIN format (17 characters)
      if (!vin || vin.length !== 17) {
        console.error('🏎️ VIN validation failed - length:', vin?.length);
        throw new Error('VIN must be exactly 17 characters');
      }
      
      console.log('🏎️ VIN validation passed');
      const url = `${this.NHTSA_API_URL}/decodevin/${vin}?format=json`;
      console.log('🏎️ Fetching from URL:', url);

      // Call NHTSA API
      const fetchStartTime = Date.now();
      const response = await fetch(url);
      const fetchEndTime = Date.now();
      
      console.log(`🏎️ Fetch took ${fetchEndTime - fetchStartTime}ms`);
      console.log('🏎️ Response status:', response.status);
      console.log('🏎️ Response ok?', response.ok);

      if (!response.ok) {
        console.error('🏎️ NHTSA API returned error status:', response.status);
        throw new Error(`NHTSA API error: ${response.status}`);
      }

      console.log('🏎️ Parsing JSON response...');
      const data: NHTSAResponse = await response.json();
      console.log('🏎️ JSON parsed, Count:', data.Count);
      console.log('🏎️ Message:', data.Message);
      
      // Parse the results into a more usable format
      console.log('🏎️ Parsing NHTSA response...');
      const vehicleData = this.parseNHTSAResponse(vin, data);
      
      console.log('🏎️ Vehicle data parsed:', vehicleData);
      return vehicleData;
    } catch (error: any) {
      console.error('🏎️💥 VINDecoder ERROR CAUGHT');
      console.error('🏎️ Error name:', error?.name);
      console.error('🏎️ Error message:', error?.message);
      console.error('🏎️ Error stack:', error?.stack);
      console.error('🏎️ Full error:', error);
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