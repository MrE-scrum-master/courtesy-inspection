# MVP Inspection Templates Specification

## Overview

**Vehicle-Type Adaptive Inspection System** - Standardized templates that automatically adapt based on VIN-decoded vehicle characteristics. Single system with consistent branding (shop logo/name only).

**Core Principle**: Universal base + vehicle-specific additions = comprehensive yet efficient inspection

**Target Metrics**:
- 30-minute completion time
- Voice-first "co-pilot" interaction
- Revenue opportunity identification
- Simple pass/fail assessment criteria

## VIN Decoder Logic

### Vehicle Classification Matrix

```yaml
vin_decoding:
  fuel_type:
    gas: "characters 4-8 engine codes"
    diesel: "characters 4-8 engine codes" 
    electric: "characters 4-8 engine codes (BEV indicators)"
    hybrid: "characters 4-8 engine codes (HEV/PHEV indicators)"
    
  drivetrain:
    fwd: "character 7 drivetrain code"
    rwd: "character 7 drivetrain code"
    awd: "character 7 drivetrain code"
    4wd: "character 7 drivetrain code"
    
  vehicle_class:
    passenger: "character 4 vehicle type"
    light_truck: "character 4 vehicle type"
    commercial: "character 4 vehicle type"
```

### Template Selection Algorithm

```
1. Decode VIN → Extract fuel_type + drivetrain + vehicle_class
2. Load universal_items (all vehicles get these)
3. Add fuel_type_specific items
4. Add drivetrain_specific items
5. Calculate total_estimated_time
6. Generate voice_command_vocabulary
```

---

## Universal Items (All Vehicles)

**Applies to**: Every vehicle regardless of type  
**Target Items**: 18 items  
**Estimated Time**: 12 minutes

### Exterior Safety

#### 1. Headlights
- **Criteria**: 
  - Green: Both function properly, clear lenses
  - Yellow: One bulb out OR lens cloudy/yellowed
  - Red: Both bulbs out OR severely damaged lens
- **Time**: 30 seconds
- **Voice**: "headlights green", "left headlight yellow", "headlights red"
- **Photo**: Required for Yellow/Red

#### 2. Taillights
- **Criteria**:
  - Green: All bulbs function, lenses intact
  - Yellow: 1-2 bulbs out OR minor lens damage
  - Red: Multiple bulbs out OR major lens damage
- **Time**: 30 seconds
- **Voice**: "taillights green", "brake light yellow", "taillights red"
- **Photo**: Required for Yellow/Red

#### 3. Turn Signals
- **Criteria**:
  - Green: All corners function properly
  - Yellow: One signal not working
  - Red: Multiple signals not working
- **Time**: 45 seconds
- **Voice**: "signals green", "left rear signal yellow", "signals red"
- **Photo**: Required for Yellow/Red

#### 4. Windshield
- **Criteria**:
  - Green: Clear, no cracks in driver view
  - Yellow: Small chips OR cracks outside driver view
  - Red: Cracks in driver line of sight
- **Time**: 30 seconds
- **Voice**: "windshield green", "windshield chip yellow", "windshield crack red"
- **Photo**: Required for Yellow/Red

### Tires & Wheels

#### 5. Front Left Tire
- **Criteria**:
  - Green: Tread >4/32", even wear, proper pressure
  - Yellow: Tread 2/32"-4/32" OR uneven wear OR low pressure
  - Red: Tread <2/32" OR sidewall damage OR flat
- **Measurements**: Tread depth (32nds), pressure (PSI)
- **Time**: 60 seconds
- **Voice**: "front left green", "front left yellow uneven wear", "front left red low tread"
- **Photo**: Required for Yellow/Red

#### 6. Front Right Tire
- **Criteria**: Same as Front Left
- **Time**: 60 seconds
- **Voice**: "front right green", "front right yellow low pressure", "front right red"
- **Photo**: Required for Yellow/Red

#### 7. Rear Left Tire
- **Criteria**: Same as Front Left
- **Time**: 60 seconds
- **Voice**: "rear left green", "rear left yellow", "rear left red sidewall damage"
- **Photo**: Required for Yellow/Red

#### 8. Rear Right Tire
- **Criteria**: Same as Front Left
- **Time**: 60 seconds
- **Voice**: "rear right green", "rear right yellow", "rear right red"
- **Photo**: Required for Yellow/Red

### Fluid Levels

#### 9. Windshield Washer Fluid
- **Criteria**:
  - Green: Full or near full
  - Yellow: Low (below minimum line)
  - Red: Empty
- **Time**: 30 seconds
- **Voice**: "washer fluid green", "washer fluid yellow", "washer fluid red"
- **Photo**: Required for Red

#### 10. Brake Fluid
- **Criteria**:
  - Green: Between min/max, clean color
  - Yellow: At minimum line OR dark/dirty
  - Red: Below minimum OR contaminated
- **Time**: 45 seconds
- **Voice**: "brake fluid green", "brake fluid yellow dirty", "brake fluid red low"
- **Photo**: Required for Yellow/Red

### Battery & Electrical

#### 11. Battery Condition
- **Criteria**:
  - Green: Clean terminals, tight connections, no corrosion
  - Yellow: Minor corrosion OR slightly loose
  - Red: Heavy corrosion OR loose connections OR swollen case
- **Time**: 60 seconds
- **Voice**: "battery green", "battery yellow corrosion", "battery red loose"
- **Photo**: Required for Yellow/Red

#### 12. Battery Voltage
- **Criteria**:
  - Green: 12.4V+ (engine off) OR 13.8V+ (running)
  - Yellow: 12.0V-12.3V (engine off) OR 13.0V-13.7V (running)
  - Red: <12.0V (engine off) OR <13.0V (running)
- **Measurements**: Voltage (V)
- **Time**: 45 seconds
- **Voice**: "voltage green twelve point six", "voltage yellow twelve point two", "voltage red eleven point eight"
- **Photo**: Not required

### Belts & Hoses

#### 13. Serpentine Belt
- **Criteria**:
  - Green: Good condition, proper tension, no cracks
  - Yellow: Minor cracking OR slightly loose
  - Red: Major cracks OR fraying OR very loose
- **Time**: 45 seconds
- **Voice**: "belt green", "belt yellow cracking", "belt red frayed"
- **Photo**: Required for Yellow/Red

#### 14. Radiator Hoses
- **Criteria**:
  - Green: Firm, no leaks, proper connections
  - Yellow: Soft spots OR minor seepage OR loose clamp
  - Red: Bulging OR active leak OR disconnected
- **Time**: 60 seconds
- **Voice**: "hoses green", "hoses yellow soft", "hoses red leak"
- **Photo**: Required for Yellow/Red

### Brakes

#### 15. Brake Pads Front
- **Criteria**:
  - Green: >5mm pad material remaining
  - Yellow: 2mm-5mm remaining OR squealing
  - Red: <2mm remaining OR metal-to-metal
- **Measurements**: Pad thickness (mm)
- **Time**: 90 seconds
- **Voice**: "front pads green", "front pads yellow thin", "front pads red metal"
- **Photo**: Required for Yellow/Red

#### 16. Brake Pads Rear
- **Criteria**: Same as Front Pads
- **Time**: 90 seconds
- **Voice**: "rear pads green", "rear pads yellow", "rear pads red"
- **Photo**: Required for Yellow/Red

### Air Filter

#### 17. Engine Air Filter
- **Criteria**:
  - Green: Clean, white/light colored
  - Yellow: Moderately dirty, some discoloration
  - Red: Very dirty, dark/black, clogged
- **Time**: 60 seconds
- **Voice**: "air filter green", "air filter yellow dirty", "air filter red clogged"
- **Photo**: Required for Yellow/Red

### Cabin Comfort

#### 18. Cabin Air Filter
- **Criteria**:
  - Green: Clean, no debris
  - Yellow: Moderately dirty OR some debris
  - Red: Very dirty OR heavily clogged OR moldy
- **Time**: 90 seconds
- **Voice**: "cabin filter green", "cabin filter yellow", "cabin filter red moldy"
- **Photo**: Required for Yellow/Red

---

## Fuel Type Specific Items

### A. Gas/Diesel Vehicles

**Applies to**: Internal combustion engines  
**Additional Items**: 8 items  
**Additional Time**: 8 minutes

#### 19. Engine Oil Level
- **Criteria**:
  - Green: Between min/max on dipstick
  - Yellow: At minimum line OR slightly over max
  - Red: Below minimum OR significantly over max
- **Measurements**: Level (min/max/over)
- **Time**: 60 seconds
- **Voice**: "oil level green", "oil level yellow low", "oil level red empty"
- **Photo**: Required for Yellow/Red

#### 20. Engine Oil Condition
- **Criteria**:
  - Green: Clean, amber/black but fluid
  - Yellow: Dark but still fluid OR slightly thick
  - Red: Very thick/sludgy OR metal particles
- **Time**: 30 seconds
- **Voice**: "oil condition green", "oil condition yellow dark", "oil condition red sludge"
- **Photo**: Required for Yellow/Red

#### 21. Coolant Level
- **Criteria**:
  - Green: Between min/max in reservoir
  - Yellow: At minimum line
  - Red: Below minimum OR empty
- **Time**: 45 seconds
- **Voice**: "coolant green", "coolant yellow low", "coolant red empty"
- **Photo**: Required for Yellow/Red

#### 22. Coolant Condition
- **Criteria**:
  - Green: Clean, proper color for type
  - Yellow: Slightly dirty OR wrong color
  - Red: Very dirty OR rusty OR contaminated
- **Time**: 30 seconds
- **Voice**: "coolant condition green", "coolant condition yellow dirty", "coolant condition red rusty"
- **Photo**: Required for Yellow/Red

#### 23. Transmission Fluid
- **Criteria**:
  - Green: Proper level, clean red color
  - Yellow: Low level OR dark color
  - Red: Very low OR black/burnt smell
- **Time**: 75 seconds
- **Voice**: "trans fluid green", "trans fluid yellow dark", "trans fluid red burnt"
- **Photo**: Required for Yellow/Red

#### 24. Power Steering Fluid
- **Criteria**:
  - Green: Proper level, clean
  - Yellow: Low level OR slightly dirty
  - Red: Very low OR contaminated
- **Time**: 45 seconds
- **Voice**: "power steering green", "power steering yellow low", "power steering red"
- **Photo**: Required for Yellow/Red

#### 25. Fuel Filter (if accessible)
- **Criteria**:
  - Green: Recent replacement OR clean
  - Yellow: Due for replacement (mileage-based)
  - Red: Overdue OR visibly dirty
- **Time**: 60 seconds
- **Voice**: "fuel filter green", "fuel filter yellow due", "fuel filter red overdue"
- **Photo**: Required for Yellow/Red

#### 26. PCV Valve
- **Criteria**:
  - Green: Rattles when shaken, proper function
  - Yellow: Doesn't rattle OR questionable
  - Red: Stuck OR obviously failed
- **Time**: 45 seconds
- **Voice**: "PCV green", "PCV yellow stuck", "PCV red failed"
- **Photo**: Required for Yellow/Red

### B. Electric Vehicles

**Applies to**: Battery Electric Vehicles (BEV)  
**Additional Items**: 6 items  
**Additional Time**: 6 minutes

#### 19. Charging Port Condition
- **Criteria**:
  - Green: Clean contacts, door functions, no damage
  - Yellow: Minor corrosion OR door issues
  - Red: Damaged contacts OR door won't close/open
- **Time**: 60 seconds
- **Voice**: "charge port green", "charge port yellow corrosion", "charge port red damaged"
- **Photo**: Required for Yellow/Red

#### 20. High Voltage Battery Health
- **Criteria**:
  - Green: No warning lights, normal range
  - Yellow: Slight range reduction OR minor warnings
  - Red: Significant range loss OR battery warnings
- **Time**: 45 seconds
- **Voice**: "HV battery green", "HV battery yellow range", "HV battery red warning"
- **Photo**: Required for Red

#### 21. Charging Cables (if present)
- **Criteria**:
  - Green: No damage, connectors clean
  - Yellow: Minor wear OR slightly dirty
  - Red: Damage to cable OR connector issues
- **Time**: 60 seconds
- **Voice**: "cables green", "cables yellow wear", "cables red damaged"
- **Photo**: Required for Yellow/Red

#### 22. Coolant (Battery)
- **Criteria**:
  - Green: Proper level for battery cooling system
  - Yellow: Slightly low
  - Red: Low OR leak detected
- **Time**: 45 seconds
- **Voice**: "battery coolant green", "battery coolant yellow", "battery coolant red leak"
- **Photo**: Required for Yellow/Red

#### 23. 12V Auxiliary Battery
- **Criteria**:
  - Green: Good condition, proper voltage
  - Yellow: Voltage slightly low OR minor corrosion
  - Red: Failed OR heavy corrosion
- **Time**: 60 seconds
- **Voice**: "aux battery green", "aux battery yellow low", "aux battery red failed"
- **Photo**: Required for Yellow/Red

#### 24. Motor/Inverter Inspection
- **Criteria**:
  - Green: No leaks, no unusual sounds
  - Yellow: Minor concerns OR slight noise
  - Red: Leaks detected OR abnormal sounds
- **Time**: 90 seconds
- **Voice**: "motor green", "motor yellow noise", "motor red leak"
- **Photo**: Required for Yellow/Red

### C. Hybrid Vehicles

**Applies to**: Hybrid Electric Vehicles (HEV/PHEV)  
**Additional Items**: 12 items (combination of gas + electric)  
**Additional Time**: 12 minutes

**Includes**: All gas vehicle items (19-26) PLUS electric-specific items (charging port for PHEV, HV battery, etc.)

#### Additional Hybrid-Specific Items:

#### 27. Hybrid Battery Cooling
- **Criteria**:
  - Green: Fan operates, no blockages
  - Yellow: Fan sluggish OR minor blockage
  - Red: Fan not working OR major blockage
- **Time**: 60 seconds
- **Voice**: "hybrid cooling green", "hybrid cooling yellow blocked", "hybrid cooling red failed"
- **Photo**: Required for Yellow/Red

#### 28. Regenerative Braking System
- **Criteria**:
  - Green: Functions normally, no warnings
  - Yellow: Reduced efficiency OR minor warnings
  - Red: Not functioning OR error messages
- **Time**: 45 seconds
- **Voice**: "regen braking green", "regen braking yellow reduced", "regen braking red failed"
- **Photo**: Required for Red

---

## Drivetrain Specific Items

### A. Front-Wheel Drive (FWD)

**Additional Items**: 4 items  
**Additional Time**: 4 minutes

#### FWD-1. CV Joints Front
- **Criteria**:
  - Green: No clicking, boots intact
  - Yellow: Minor clicking OR boot slightly torn
  - Red: Major clicking OR boot severely damaged
- **Time**: 60 seconds
- **Voice**: "CV joints green", "CV joints yellow clicking", "CV joints red torn boot"
- **Photo**: Required for Yellow/Red

#### FWD-2. Front Struts/Shocks
- **Criteria**:
  - Green: No leaks, proper damping
  - Yellow: Minor seepage OR slight bounce
  - Red: Active leak OR excessive bounce
- **Time**: 60 seconds
- **Voice**: "front struts green", "front struts yellow seepage", "front struts red leak"
- **Photo**: Required for Yellow/Red

#### FWD-3. Engine Mounts
- **Criteria**:
  - Green: Secure, no excessive movement
  - Yellow: Slight movement OR minor wear
  - Red: Excessive movement OR broken mount
- **Time**: 45 seconds
- **Voice**: "engine mounts green", "engine mounts yellow loose", "engine mounts red broken"
- **Photo**: Required for Yellow/Red

#### FWD-4. Transaxle Inspection
- **Criteria**:
  - Green: No leaks, proper operation
  - Yellow: Minor seepage OR slight noise
  - Red: Active leak OR abnormal noise
- **Time**: 75 seconds
- **Voice**: "transaxle green", "transaxle yellow seepage", "transaxle red leak"
- **Photo**: Required for Yellow/Red

### B. Rear-Wheel Drive (RWD)

**Additional Items**: 6 items  
**Additional Time**: 6 minutes

#### RWD-1. Driveshaft
- **Criteria**:
  - Green: No vibration, U-joints good
  - Yellow: Slight vibration OR minor U-joint wear
  - Red: Excessive vibration OR U-joint failure
- **Time**: 60 seconds
- **Voice**: "driveshaft green", "driveshaft yellow vibration", "driveshaft red U-joint"
- **Photo**: Required for Yellow/Red

#### RWD-2. Rear Differential
- **Criteria**:
  - Green: Proper fluid level, no leaks
  - Yellow: Low fluid OR minor seepage
  - Red: Very low fluid OR active leak
- **Time**: 75 seconds
- **Voice**: "rear diff green", "rear diff yellow low", "rear diff red leak"
- **Photo**: Required for Yellow/Red

#### RWD-3. Rear Shocks/Springs
- **Criteria**:
  - Green: No leaks, proper height
  - Yellow: Minor seepage OR slight sag
  - Red: Active leak OR significant sag
- **Time**: 60 seconds
- **Voice**: "rear shocks green", "rear shocks yellow sag", "rear shocks red leak"
- **Photo**: Required for Yellow/Red

#### RWD-4. Transmission (separate from engine)
- **Criteria**:
  - Green: No leaks, proper fluid
  - Yellow: Minor seepage OR fluid due
  - Red: Active leak OR burnt fluid
- **Time**: 75 seconds
- **Voice**: "transmission green", "transmission yellow seepage", "transmission red leak"
- **Photo**: Required for Yellow/Red

#### RWD-5. Exhaust System
- **Criteria**:
  - Green: Secure, no damage, quiet
  - Yellow: Minor rust OR slightly loose
  - Red: Holes OR very loose OR loud
- **Time**: 90 seconds
- **Voice**: "exhaust green", "exhaust yellow rust", "exhaust red hole"
- **Photo**: Required for Yellow/Red

#### RWD-6. Rear Axle Seals
- **Criteria**:
  - Green: No leaks visible
  - Yellow: Minor seepage
  - Red: Active leak
- **Time**: 60 seconds
- **Voice**: "axle seals green", "axle seals yellow seepage", "axle seals red leak"
- **Photo**: Required for Yellow/Red

### C. All-Wheel Drive / Four-Wheel Drive (AWD/4WD)

**Additional Items**: 8 items  
**Additional Time**: 8 minutes

#### AWD-1. Transfer Case
- **Criteria**:
  - Green: Proper fluid level, no leaks
  - Yellow: Low fluid OR minor seepage
  - Red: Very low fluid OR active leak
- **Time**: 75 seconds
- **Voice**: "transfer case green", "transfer case yellow low", "transfer case red leak"
- **Photo**: Required for Yellow/Red

#### AWD-2. Front Differential
- **Criteria**:
  - Green: Proper fluid level, no leaks
  - Yellow: Low fluid OR minor seepage
  - Red: Very low fluid OR active leak
- **Time**: 75 seconds
- **Voice**: "front diff green", "front diff yellow low", "front diff red leak"
- **Photo**: Required for Yellow/Red

#### AWD-3. Rear Differential
- **Criteria**: Same as RWD-2
- **Time**: 75 seconds
- **Voice**: "rear diff green", "rear diff yellow", "rear diff red"
- **Photo**: Required for Yellow/Red

#### AWD-4. CV Joints (All Four Corners)
- **Criteria**:
  - Green: No clicking, boots intact
  - Yellow: Minor clicking OR boot damage
  - Red: Major clicking OR severe boot damage
- **Time**: 120 seconds (all four corners)
- **Voice**: "all CV joints green", "right front CV yellow", "CV joints red"
- **Photo**: Required for Yellow/Red

#### AWD-5. All-Wheel Drive Coupling
- **Criteria**:
  - Green: Engages properly, no noise
  - Yellow: Slow engagement OR minor noise
  - Red: Won't engage OR excessive noise
- **Time**: 90 seconds
- **Voice**: "AWD coupling green", "AWD coupling yellow slow", "AWD coupling red failed"
- **Photo**: Required for Red

#### AWD-6. Drive Shafts (Multiple)
- **Criteria**:
  - Green: No vibration, joints good
  - Yellow: Slight vibration OR minor wear
  - Red: Excessive vibration OR joint failure
- **Time**: 90 seconds
- **Voice**: "drive shafts green", "drive shafts yellow vibration", "drive shafts red"
- **Photo**: Required for Yellow/Red

#### AWD-7. Electronic AWD System
- **Criteria**:
  - Green: No warning lights, functions normally
  - Yellow: Intermittent warnings OR reduced function
  - Red: Constant warnings OR system failure
- **Time**: 45 seconds
- **Voice**: "AWD system green", "AWD system yellow warning", "AWD system red failed"
- **Photo**: Required for Red

#### AWD-8. Additional Cooling (AWD components)
- **Criteria**:
  - Green: No overheating, proper function
  - Yellow: Slightly warm OR minor issues
  - Red: Overheating OR cooling failure
- **Time**: 60 seconds
- **Voice**: "AWD cooling green", "AWD cooling yellow warm", "AWD cooling red hot"
- **Photo**: Required for Yellow/Red

---

## Time Calculations by Vehicle Type

### Base Universal Items
- **Time**: 12 minutes (18 items × 40 seconds average)
- **Items**: 18 universal items

### Fuel Type Additions
- **Gas/Diesel**: +8 minutes (8 items)
- **Electric**: +6 minutes (6 items)
- **Hybrid**: +12 minutes (12 items)

### Drivetrain Additions
- **FWD**: +4 minutes (4 items)
- **RWD**: +6 minutes (6 items)
- **AWD/4WD**: +8 minutes (8 items)

### Total Time Estimates

| Vehicle Configuration | Total Items | Total Time | Example |
|----------------------|-------------|------------|---------|
| Gas FWD | 30 items | 24 minutes | Honda Civic |
| Gas RWD | 32 items | 26 minutes | BMW 3-Series |
| Gas AWD | 34 items | 28 minutes | Subaru Outback |
| Electric FWD | 28 items | 22 minutes | Tesla Model 3 |
| Electric AWD | 32 items | 26 minutes | Tesla Model Y |
| Hybrid FWD | 34 items | 28 minutes | Toyota Prius |
| Hybrid AWD | 38 items | 32 minutes | Toyota RAV4 Hybrid |

**Target Range**: 22-32 minutes (within 30-minute goal)

---

## Voice Command Vocabulary

### Universal Commands
```yaml
status_commands:
  - "green" | "good" | "pass" | "okay"
  - "yellow" | "caution" | "fair" | "due soon"
  - "red" | "failed" | "immediate" | "replace now"

navigation:
  - "next item" | "skip" | "previous"
  - "take photo" | "add note" | "voice note"
  - "repeat item" | "item details"

measurements:
  - "twelve point six volts"
  - "four thirty-seconds tread"
  - "thirty-five PSI"
  - "five millimeters pad"
```

### Item-Specific Commands
```yaml
tires:
  - "front left green"
  - "rear right yellow uneven wear"
  - "front right red low tread"

fluids:
  - "oil level green"
  - "brake fluid yellow dirty"
  - "coolant red empty"

electrical:
  - "battery green"
  - "voltage twelve point four"
  - "headlights yellow left bulb"

brakes:
  - "front pads green"
  - "rear pads yellow thin"
  - "brake pads red metal"
```

### Fuel Type Specific
```yaml
gas_diesel:
  - "oil condition green"
  - "trans fluid yellow dark"
  - "power steering red low"
  - "PCV valve green rattles"

electric:
  - "charge port green"
  - "HV battery yellow range"
  - "motor red leak"
  - "aux battery green"

hybrid:
  - "hybrid cooling green"
  - "regen braking yellow"
  - "battery cooling red leak"
```

### Drivetrain Specific
```yaml
fwd:
  - "CV joints green"
  - "front struts yellow seepage"
  - "engine mounts red broken"

rwd:
  - "driveshaft green"
  - "rear diff yellow low"
  - "exhaust red hole"

awd:
  - "transfer case green"
  - "AWD system yellow warning"
  - "all CV joints green"
```

---

## Revenue Opportunity Mapping

### Immediate Safety (Red Items)
- **Priority**: Highest
- **Customer Impact**: Safety risk
- **Revenue**: $150-$2000+ per item
- **Examples**: Brake pads metal-to-metal, tire below 2/32", battery failure

### Maintenance Due (Yellow Items)
- **Priority**: Medium
- **Customer Impact**: Prevent future problems
- **Revenue**: $50-$800 per item
- **Examples**: Dirty air filter, low fluids, minor wear items

### Preventive Opportunities
- **Priority**: Lower
- **Customer Impact**: Optimal performance
- **Revenue**: $25-$400 per item
- **Examples**: Cabin air filter, transmission service due

### Package Opportunities
```yaml
tire_package:
  triggers: [2+ tires yellow/red]
  revenue: $400-1200
  items: [alignment, balancing, rotation]

fluid_service_package:
  triggers: [3+ fluids yellow/red]
  revenue: $200-600
  items: [coolant_flush, trans_service, brake_flush]

electrical_package:
  triggers: [battery + alternator concerns]
  revenue: $300-800
  items: [battery, alternator, starter_test]

brake_package:
  triggers: [pads + rotors concerns]
  revenue: $400-1200
  items: [pads, rotors, brake_fluid]
```

---

## Implementation Notes

### Data Structure
```json
{
  "vehicle": {
    "vin": "1HGBH41JXMN109186",
    "fuel_type": "gas",
    "drivetrain": "fwd",
    "year": 2021,
    "make": "Honda",
    "model": "Accord"
  },
  "inspection_template": {
    "universal_items": [...],
    "fuel_specific_items": [...],
    "drivetrain_specific_items": [...]
  },
  "estimated_time": 24,
  "total_items": 30
}
```

### Photo Requirements
- **Automatic**: All Yellow/Red items require photo
- **Optional**: Green items can have photos for documentation
- **Storage**: Link photos to specific inspection items
- **Quality**: Minimum resolution for detail visibility

### Voice Recognition Optimization
- **Noise Cancellation**: Shop environment considerations
- **Accent Training**: Multiple pronunciation variations
- **Context Awareness**: Item-specific vocabulary activation
- **Error Handling**: "Did you mean..." suggestions

### Quality Assurance
- **Completion Validation**: Ensure all applicable items checked
- **Photo Verification**: Yellow/Red items must have photos
- **Time Tracking**: Monitor actual vs. estimated times
- **Technician Feedback**: Collect data for template refinement

---

## Future Enhancements

### Advanced VIN Decoding
- **Year-Specific Items**: Add items based on vehicle age
- **Model-Specific**: Special inspections for known issues
- **Recall Integration**: Check for open recalls during inspection

### Dynamic Templates
- **Learning Algorithm**: Adjust templates based on findings
- **Regional Variations**: Climate-specific inspection items
- **Shop Customization**: Additional items for specialty shops

### Integration Opportunities
- **Parts Catalogs**: Link inspection findings to part numbers
- **Labor Times**: Integrate with shop labor guide
- **Estimate Generation**: Automatic repair estimates from findings

This specification provides a complete foundation for implementing the MVP inspection template system with vehicle-type adaptive capabilities, voice-first interaction, and revenue opportunity identification.