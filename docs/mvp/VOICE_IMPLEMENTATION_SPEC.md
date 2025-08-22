# Voice Implementation Specification
## KISS Architecture for Native Speech Recognition

**Version**: 1.0  
**Status**: SPEC FINAL - AWAITING IMPLEMENTATION  
**Last Updated**: December 2024  
**Approach**: Leverage native device capabilities, minimal custom code

---

## Executive Summary

This specification defines the voice implementation for Courtesy Inspection using a KISS (Keep It Simple, Stupid) approach. We leverage the device's native speech recognition capabilities (iOS Speech Framework and Android SpeechRecognizer) through the `expo-speech-recognition` package, adding only a thin layer of automotive vocabulary hints and command matching.

**Key Decision**: We do NOT build custom speech recognition. We use what Apple and Google have already perfected.

---

## Core Architecture

### 1. Technology Stack

```yaml
speech_recognition:
  package: expo-speech-recognition v2.1.1
  ios_backend: Native iOS Speech Framework
  android_backend: Native Android SpeechRecognizer
  approach: Device-native (no cloud dependency)
  
audio_handling:
  bluetooth: Handled by OS (automatic routing)
  noise_cancellation: Handled by hardware (AirPods, etc.)
  permissions: Microphone permission only
```

### 2. Simple Three-Layer Architecture

```
┌─────────────────────────────────────┐
│   Layer 1: Voice Input              │
│   (Device handles everything)       │
│   - Audio capture                   │
│   - Noise cancellation              │
│   - Speech-to-text                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Layer 2: Vocabulary Bias          │
│   (We provide hints only)           │
│   - Automotive terms list           │
│   - Command keywords                │
│   - Common phrases                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Layer 3: Command Matching         │
│   (Simple string matching)          │
│   - Parse recognized text           │
│   - Match to commands               │
│   - Execute actions                 │
└─────────────────────────────────────┘
```

---

## Implementation Details

### Complete Voice System (50 Lines)

```javascript
// voiceCommands.js - THE ENTIRE VOICE SYSTEM

import ExpoSpeechRecognition from 'expo-speech-recognition';

// Command definitions
const COMMANDS = {
  status: {
    green: ["green", "good", "okay", "fine", "pass"],
    yellow: ["yellow", "worn", "marginal", "monitor", "watch"],
    red: ["red", "bad", "fail", "replace", "critical"]
  },
  navigation: {
    next: ["next", "continue", "forward"],
    previous: ["previous", "back", "go back"],
    skip: ["skip", "pass", "skip this"]
  },
  actions: {
    photo: ["take photo", "photo", "picture", "capture"],
    note: ["add note", "note", "comment"],
    complete: ["complete", "done", "finish", "complete section"]
  },
  measurements: {
    pattern: /(\d+)\s*(millimeters?|mm|psi|percent|%|thirty-seconds?|32nds?)/i
  }
};

// Automotive vocabulary for recognition bias
const AUTOMOTIVE_VOCABULARY = [
  // Fluids
  "oil", "coolant", "brake fluid", "transmission fluid", 
  "power steering", "washer fluid", "differential",
  
  // Components
  "tire", "tread", "brake pad", "rotor", "belt", 
  "hose", "filter", "battery", "alternator", "starter",
  
  // Conditions
  "leak", "worn", "cracked", "damaged", "corroded",
  "loose", "tight", "aligned", "balanced",
  
  // Measurements
  "millimeters", "psi", "percent", "thirty-seconds"
];

// Initialize voice recognition
export const initializeVoice = async () => {
  const { granted } = await ExpoSpeechRecognition.requestPermissionsAsync();
  if (!granted) throw new Error('Microphone permission denied');
  
  return ExpoSpeechRecognition.start({
    lang: 'en-US',
    interimResults: true,
    continuous: true,
    contextualStrings: [
      ...Object.values(COMMANDS.status).flat(),
      ...Object.values(COMMANDS.navigation).flat(),
      ...Object.values(COMMANDS.actions).flat(),
      ...AUTOMOTIVE_VOCABULARY
    ]
  });
};

// Handle recognized speech
export const handleSpeechResult = (text) => {
  const lower = text.toLowerCase().trim();
  
  // Check status commands
  for (const [status, keywords] of Object.entries(COMMANDS.status)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return { type: 'status', value: status };
    }
  }
  
  // Check navigation commands
  for (const [action, keywords] of Object.entries(COMMANDS.navigation)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return { type: 'navigation', value: action };
    }
  }
  
  // Check action commands
  for (const [action, keywords] of Object.entries(COMMANDS.actions)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return { type: 'action', value: action };
    }
  }
  
  // Check for measurements
  const measurementMatch = lower.match(COMMANDS.measurements.pattern);
  if (measurementMatch) {
    return { 
      type: 'measurement', 
      value: measurementMatch[1],
      unit: measurementMatch[2] 
    };
  }
  
  // Unknown command - return raw text for fallback processing
  return { type: 'unknown', value: text };
};

// Stop listening
export const stopListening = () => {
  ExpoSpeechRecognition.stop();
};
```

### That's It! The Entire Implementation.

---

## What We DON'T Need

### ❌ Things We're NOT Building:
1. **Custom speech recognition engine** - Use device native
2. **Audio processing algorithms** - Device handles this
3. **Noise cancellation** - Hardware (AirPods) handles this
4. **Bluetooth pairing logic** - OS handles this
5. **Training data or ML models** - Not needed
6. **Cloud speech APIs** - Device works offline
7. **Complex error recovery** - Simple fallback to manual input
8. **Voice activity detection** - Built into native APIs
9. **Wake word detection** - Not needed for our use case
10. **Speaker identification** - Not needed

---

## Automotive Vocabulary

### Core Terms (100 words)

```javascript
const AUTOMOTIVE_TERMS = {
  fluids: [
    "oil", "engine oil", "motor oil",
    "coolant", "antifreeze", 
    "brake fluid", "brake juice",
    "transmission fluid", "trans fluid", "ATF",
    "power steering fluid", "PS fluid",
    "washer fluid", "windshield fluid",
    "differential fluid", "diff fluid"
  ],
  
  components: [
    "tire", "tires", "rubber",
    "tread", "tread depth",
    "brake", "brakes", "brake pad", "pads",
    "rotor", "rotors", "disc",
    "belt", "serpentine", "timing belt",
    "hose", "hoses", "radiator hose",
    "filter", "air filter", "oil filter",
    "battery", "alternator", "starter"
  ],
  
  conditions: [
    "good", "bad", "worn", "new",
    "leak", "leaking", "seepage",
    "crack", "cracked", "damaged",
    "corroded", "rusty", "oxidized",
    "loose", "tight", "missing",
    "bent", "warped", "glazed"
  ],
  
  locations: [
    "front", "rear", "left", "right",
    "driver", "passenger",
    "LF", "RF", "LR", "RR", // Left Front, etc.
    "inside", "outside", "inner", "outer"
  ],
  
  measurements: [
    "millimeter", "millimeters", "mm",
    "thirty-seconds", "32nds",
    "psi", "pounds",
    "percent", "%",
    "low", "full", "empty", "half"
  ]
};
```

---

## Command Matching Logic

### Simple String Matching Approach

```javascript
// Priority order for matching (first match wins)
1. Exact command match ("next", "previous")
2. Status keywords ("green", "good", "pass")
3. Measurement patterns (number + unit)
4. Action phrases ("take photo", "add note")
5. Unknown (fallback to manual input)
```

### Fuzzy Matching Tolerance

```javascript
// We DON'T implement complex fuzzy matching
// The device's speech recognition already handles:
// - Accents and pronunciations
// - Background noise
// - Similar sounding words

// We just do simple includes() checks:
if (text.includes("green") || text.includes("good")) {
  // Mark as green
}
```

---

## Testing Requirements

### Simple Test Scenarios

1. **Basic Commands** (10 commands)
   - Say "green" → Status set to green
   - Say "next" → Navigate to next item
   - Say "take photo" → Camera opens

2. **Automotive Terms** (20 terms)
   - Say "brake fluid low" → Captures all words
   - Say "3 millimeters" → Captures measurement
   - Say "left front worn" → Captures location + condition

3. **Real Environment** (5 scenarios)
   - Test with Bluetooth headset connected
   - Test in noisy environment (radio on)
   - Test with gloves (affects button pressing only)
   - Test with multiple accents
   - Test offline mode

### Success Criteria
- **Recognition Accuracy**: >85% for command words
- **Response Time**: <500ms from speech end to action
- **Offline Performance**: 100% functionality without internet

---

## Configuration

### Required Permissions

```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "Allow Courtesy Inspection to use microphone for voice commands",
          "speechRecognitionPermission": "Allow Courtesy Inspection to recognize speech for hands-free operation"
        }
      ]
    ]
  }
}
```

### Environment Variables

```bash
# .env
# Voice configuration
VOICE_ENABLED=true
VOICE_LANGUAGE=en-US
VOICE_CONTINUOUS=true
VOICE_INTERIM_RESULTS=true
```

---

## Error Handling

### Simple Fallback Strategy

```javascript
// If voice recognition fails or returns "unknown"
1. Show what was heard: "I heard: '{text}'"
2. Provide manual buttons as fallback
3. Log for vocabulary improvement
4. Continue working (non-blocking)

// No complex error recovery needed!
```

---

## Performance Considerations

### Resource Usage
- **CPU**: ~5% during active listening (handled by OS)
- **Memory**: ~10MB for vocabulary (negligible)
- **Battery**: Minimal impact (native optimization)
- **Network**: ZERO (fully offline)

---

## Future Considerations (NOT MVP)

### Post-MVP Enhancements (YAGNI for now)
1. Custom wake word ("Hey Courtesy")
2. Voice feedback/confirmation
3. Multi-language support
4. Voice training per user
5. Complex command chaining

**Current Status**: These are NOT needed for MVP. We keep it simple.

---

## Implementation Checklist

- [ ] Install expo-speech-recognition package
- [ ] Add microphone permissions to app.json
- [ ] Copy the 50-line voice system code
- [ ] Add automotive vocabulary list
- [ ] Test with 10 basic commands
- [ ] Test with Bluetooth headset
- [ ] Test in garage environment
- [ ] Document any new terms mechanics use

---

## Conclusion

This voice implementation follows KISS principles by leveraging existing device capabilities rather than building custom solutions. The entire system is ~50 lines of code, requires no complex algorithms, and provides a robust voice interface for automotive inspections.

**Total Implementation Time**: 2-3 days (mostly testing)  
**Maintenance Burden**: Minimal (just vocabulary updates)  
**Dependencies**: 1 package (expo-speech-recognition)  

---

**Document Status**: SPEC FINAL - AWAITING IMPLEMENTATION  
**Approved By**: Technical Architecture Team  
**Implementation Priority**: HIGH (Core Differentiator)