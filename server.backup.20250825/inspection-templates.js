/**
 * Inspection Checklist Templates
 * Pre-defined inspection item templates for different inspection types
 */

const INSPECTION_TEMPLATES = {
  // Basic 25-point inspection
  basic: {
    name: 'Basic Inspection',
    description: '25-point courtesy inspection',
    points: 25,
    categories: {
      'Engine': [
        { component: 'Oil Level', order: 1 },
        { component: 'Oil Condition', order: 2 },
        { component: 'Coolant Level', order: 3 },
        { component: 'Air Filter', order: 4 },
        { component: 'Battery Condition', order: 5 },
        { component: 'Belt Condition', order: 6 }
      ],
      'Transmission': [
        { component: 'Fluid Level', order: 7 },
        { component: 'Fluid Condition', order: 8 }
      ],
      'Brakes': [
        { component: 'Brake Pads Front', order: 9 },
        { component: 'Brake Pads Rear', order: 10 },
        { component: 'Brake Fluid Level', order: 11 },
        { component: 'Brake Rotors', order: 12 }
      ],
      'Suspension': [
        { component: 'Shocks/Struts', order: 13 },
        { component: 'Springs', order: 14 }
      ],
      'Tires': [
        { component: 'Tire Tread Front', order: 15 },
        { component: 'Tire Tread Rear', order: 16 },
        { component: 'Tire Pressure All', order: 17 }
      ],
      'Lights': [
        { component: 'Headlights', order: 18 },
        { component: 'Taillights', order: 19 },
        { component: 'Turn Signals', order: 20 },
        { component: 'Brake Lights', order: 21 }
      ],
      'Safety': [
        { component: 'Windshield Wipers', order: 22 },
        { component: 'Windshield Washer Fluid', order: 23 },
        { component: 'Horn', order: 24 },
        { component: 'Seatbelts', order: 25 }
      ]
    }
  },

  // Comprehensive 50-point inspection
  comprehensive: {
    name: 'Comprehensive Inspection',
    description: '50-point detailed inspection',
    points: 50,
    categories: {
      'Engine': [
        { component: 'Oil Level', order: 1 },
        { component: 'Oil Condition', order: 2 },
        { component: 'Oil Filter', order: 3 },
        { component: 'Coolant Level', order: 4 },
        { component: 'Coolant Condition', order: 5 },
        { component: 'Air Filter', order: 6 },
        { component: 'Cabin Filter', order: 7 },
        { component: 'Battery Condition', order: 8 },
        { component: 'Battery Terminals', order: 9 },
        { component: 'Alternator Belt', order: 10 },
        { component: 'Serpentine Belt', order: 11 },
        { component: 'Spark Plugs', order: 12 }
      ],
      'Transmission': [
        { component: 'Fluid Level', order: 13 },
        { component: 'Fluid Condition', order: 14 },
        { component: 'Filter Condition', order: 15 }
      ],
      'Brakes': [
        { component: 'Brake Pads Front', order: 16 },
        { component: 'Brake Pads Rear', order: 17 },
        { component: 'Brake Rotors Front', order: 18 },
        { component: 'Brake Rotors Rear', order: 19 },
        { component: 'Brake Fluid Level', order: 20 },
        { component: 'Brake Fluid Condition', order: 21 },
        { component: 'Brake Lines', order: 22 },
        { component: 'Parking Brake', order: 23 }
      ],
      'Suspension': [
        { component: 'Shocks Front', order: 24 },
        { component: 'Shocks Rear', order: 25 },
        { component: 'Struts', order: 26 },
        { component: 'Springs', order: 27 },
        { component: 'Ball Joints', order: 28 },
        { component: 'Tie Rod Ends', order: 29 }
      ],
      'Tires & Wheels': [
        { component: 'Tire Tread Front Left', order: 30 },
        { component: 'Tire Tread Front Right', order: 31 },
        { component: 'Tire Tread Rear Left', order: 32 },
        { component: 'Tire Tread Rear Right', order: 33 },
        { component: 'Tire Pressure All', order: 34 },
        { component: 'Wheel Alignment', order: 35 }
      ],
      'Lights & Electrical': [
        { component: 'Headlights', order: 36 },
        { component: 'Taillights', order: 37 },
        { component: 'Turn Signals', order: 38 },
        { component: 'Brake Lights', order: 39 },
        { component: 'Hazard Lights', order: 40 },
        { component: 'Interior Lights', order: 41 }
      ],
      'Safety & Comfort': [
        { component: 'Windshield Wipers', order: 42 },
        { component: 'Windshield Washer Fluid', order: 43 },
        { component: 'Horn', order: 44 },
        { component: 'Seatbelts', order: 45 },
        { component: 'Air Conditioning', order: 46 },
        { component: 'Heater', order: 47 }
      ],
      'Exhaust & Emissions': [
        { component: 'Exhaust System', order: 48 },
        { component: 'Catalytic Converter', order: 49 },
        { component: 'Emissions Test', order: 50 }
      ]
    }
  },

  // Premium 100-point inspection
  premium: {
    name: 'Premium Inspection',
    description: '100-point complete vehicle inspection',
    points: 100,
    categories: {
      'Engine': [
        { component: 'Oil Level', order: 1 },
        { component: 'Oil Condition', order: 2 },
        { component: 'Oil Filter', order: 3 },
        { component: 'Oil Pan Condition', order: 4 },
        { component: 'Coolant Level', order: 5 },
        { component: 'Coolant Condition', order: 6 },
        { component: 'Radiator Condition', order: 7 },
        { component: 'Thermostat', order: 8 },
        { component: 'Water Pump', order: 9 },
        { component: 'Air Filter', order: 10 },
        { component: 'Cabin Filter', order: 11 },
        { component: 'Fuel Filter', order: 12 },
        { component: 'Battery Condition', order: 13 },
        { component: 'Battery Terminals', order: 14 },
        { component: 'Alternator', order: 15 },
        { component: 'Starter', order: 16 },
        { component: 'Alternator Belt', order: 17 },
        { component: 'Serpentine Belt', order: 18 },
        { component: 'Timing Belt', order: 19 },
        { component: 'Spark Plugs', order: 20 },
        { component: 'Spark Plug Wires', order: 21 },
        { component: 'Ignition Coils', order: 22 },
        { component: 'PCV Valve', order: 23 },
        { component: 'Engine Mounts', order: 24 },
        { component: 'Valve Cover Gasket', order: 25 }
      ],
      'Transmission': [
        { component: 'Fluid Level', order: 26 },
        { component: 'Fluid Condition', order: 27 },
        { component: 'Filter Condition', order: 28 },
        { component: 'Pan Gasket', order: 29 },
        { component: 'CV Joints', order: 30 },
        { component: 'CV Boots', order: 31 },
        { component: 'Differential Fluid', order: 32 }
      ],
      'Brakes': [
        { component: 'Brake Pads Front', order: 33 },
        { component: 'Brake Pads Rear', order: 34 },
        { component: 'Brake Rotors Front', order: 35 },
        { component: 'Brake Rotors Rear', order: 36 },
        { component: 'Brake Calipers Front', order: 37 },
        { component: 'Brake Calipers Rear', order: 38 },
        { component: 'Brake Fluid Level', order: 39 },
        { component: 'Brake Fluid Condition', order: 40 },
        { component: 'Brake Lines', order: 41 },
        { component: 'Brake Hoses', order: 42 },
        { component: 'Master Cylinder', order: 43 },
        { component: 'Parking Brake', order: 44 },
        { component: 'ABS System', order: 45 }
      ],
      'Suspension & Steering': [
        { component: 'Shocks Front', order: 46 },
        { component: 'Shocks Rear', order: 47 },
        { component: 'Struts Front', order: 48 },
        { component: 'Struts Rear', order: 49 },
        { component: 'Springs Front', order: 50 },
        { component: 'Springs Rear', order: 51 },
        { component: 'Ball Joints Upper', order: 52 },
        { component: 'Ball Joints Lower', order: 53 },
        { component: 'Tie Rod Ends', order: 54 },
        { component: 'Control Arms', order: 55 },
        { component: 'Sway Bar Links', order: 56 },
        { component: 'Steering Rack', order: 57 },
        { component: 'Power Steering Fluid', order: 58 },
        { component: 'Power Steering Belt', order: 59 },
        { component: 'Wheel Bearings', order: 60 }
      ],
      'Tires & Wheels': [
        { component: 'Tire Tread Front Left', order: 61 },
        { component: 'Tire Tread Front Right', order: 62 },
        { component: 'Tire Tread Rear Left', order: 63 },
        { component: 'Tire Tread Rear Right', order: 64 },
        { component: 'Tire Pressure All', order: 65 },
        { component: 'Wheel Alignment', order: 66 },
        { component: 'Wheel Balance', order: 67 },
        { component: 'Rim Condition', order: 68 },
        { component: 'Spare Tire', order: 69 }
      ],
      'Lights & Electrical': [
        { component: 'Headlights', order: 70 },
        { component: 'Taillights', order: 71 },
        { component: 'Turn Signals', order: 72 },
        { component: 'Brake Lights', order: 73 },
        { component: 'Reverse Lights', order: 74 },
        { component: 'Hazard Lights', order: 75 },
        { component: 'Interior Lights', order: 76 },
        { component: 'Dashboard Lights', order: 77 },
        { component: 'License Plate Light', order: 78 },
        { component: 'Wiring Harness', order: 79 }
      ],
      'Safety & Comfort': [
        { component: 'Windshield Wipers Front', order: 80 },
        { component: 'Windshield Wipers Rear', order: 81 },
        { component: 'Windshield Washer Fluid', order: 82 },
        { component: 'Horn', order: 83 },
        { component: 'Seatbelts Front', order: 84 },
        { component: 'Seatbelts Rear', order: 85 },
        { component: 'Air Conditioning', order: 86 },
        { component: 'Heater', order: 87 },
        { component: 'Defroster', order: 88 },
        { component: 'Mirrors', order: 89 }
      ],
      'Body & Interior': [
        { component: 'Door Locks', order: 90 },
        { component: 'Window Operation', order: 91 },
        { component: 'Seat Adjustment', order: 92 },
        { component: 'Carpet/Floor Mats', order: 93 }
      ],
      'Exhaust & Emissions': [
        { component: 'Exhaust Manifold', order: 94 },
        { component: 'Exhaust Pipes', order: 95 },
        { component: 'Muffler', order: 96 },
        { component: 'Catalytic Converter', order: 97 },
        { component: 'Oxygen Sensors', order: 98 },
        { component: 'EGR Valve', order: 99 },
        { component: 'Emissions Test', order: 100 }
      ]
    }
  },

  // Quick 10-point inspection
  quick: {
    name: 'Quick Check',
    description: '10-point quick inspection',
    points: 10,
    categories: {
      'Essential Fluids': [
        { component: 'Engine Oil', order: 1 },
        { component: 'Brake Fluid', order: 2 },
        { component: 'Coolant', order: 3 }
      ],
      'Safety Items': [
        { component: 'Brake Pads', order: 4 },
        { component: 'Tire Tread', order: 5 },
        { component: 'Lights', order: 6 },
        { component: 'Wipers', order: 7 }
      ],
      'Basic Systems': [
        { component: 'Battery', order: 8 },
        { component: 'Air Filter', order: 9 },
        { component: 'Belts', order: 10 }
      ]
    }
  }
};

/**
 * Generate inspection items from template
 * @param {string} templateType - The template type (basic, comprehensive, premium, quick)
 * @param {string} inspectionId - The inspection ID to associate items with
 * @returns {Array} Array of inspection items ready for database insertion
 */
function generateInspectionItems(templateType, inspectionId) {
  const template = INSPECTION_TEMPLATES[templateType];
  if (!template) {
    throw new Error(`Unknown inspection template: ${templateType}`);
  }

  const items = [];
  
  for (const [categoryName, components] of Object.entries(template.categories)) {
    for (const component of components) {
      items.push({
        inspection_id: inspectionId,
        category: categoryName,
        component: component.component,
        status: 'pending', // pending, good, attention_needed, critical
        severity: null, // minor, moderate, major, critical
        notes: null,
        measurement_value: null,
        measurement_unit: null,
        cost_estimate: null,
        photo_url: null,
        order: component.order
      });
    }
  }
  
  return items;
}

/**
 * Get available templates
 * @returns {Array} Array of available template metadata
 */
function getAvailableTemplates() {
  return Object.keys(INSPECTION_TEMPLATES).map(key => ({
    id: key,
    name: INSPECTION_TEMPLATES[key].name,
    description: INSPECTION_TEMPLATES[key].description,
    points: INSPECTION_TEMPLATES[key].points
  }));
}

/**
 * Get template details
 * @param {string} templateType - The template type
 * @returns {Object} Template details with categories and items
 */
function getTemplate(templateType) {
  return INSPECTION_TEMPLATES[templateType] || null;
}

module.exports = {
  INSPECTION_TEMPLATES,
  generateInspectionItems,
  getAvailableTemplates,
  getTemplate
};