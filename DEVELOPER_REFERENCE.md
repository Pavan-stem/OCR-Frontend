# AI Document Scanner - Developer Quick Reference

## Quick Start for Developers

### File Structure
```
src/
├── smartcamera.jsx           # Camera UI & validation modal
├── SHGUploadSection.jsx       # Upload interface integration
├── utils/
│   ├── documentScanner.js     # Core validation engine ⭐
│   ├── imageQualityCheck.js   # Legacy quality checks
│   └── apiConfig.js           # API configuration
└── docs/
    ├── AI_DOCUMENT_SCANNER.md       # Full documentation
    └── IMPLEMENTATION_SUMMARY.md    # Implementation details
```

## Core Functions

### documentScanner.js
```javascript
// Main scanning function
scanDocument(file: File) → Promise<ValidationResult>

// Convert canvas to file
canvasToFile(canvas, filename) → Promise<File>

// Helper functions (internal)
detectBlur(grayData, width, height)
analyzeLighting(grayData, width, height)
detectDocumentEdges(grayData, width, height)
detectTableStructure(grayData, width, height)
validateTextPresence(grayData, width, height)
enhanceImage(canvas)
```

## Validation Result Object

```javascript
{
  isValid: boolean,                    // Overall validation status
  issues: string[],                    // Array of user-friendly error messages
  validations: {
    blur: {
      isBlurry: boolean,
      blurScore: number,              // Laplacian variance
      threshold: number                // Comparison threshold
    },
    lighting: {
      quality: 'good' | 'dark' | 'overexposed' | 'lowcontrast',
      avgBrightness: number,          // 0-255
      dynamicRange: number,           // max - min brightness
      shadowDifference: number        // quadrant variance
    },
    edges: {
      detected: boolean,
      bounds: { minX, minY, maxX, maxY },
      dimensions: { width, height },
      edgePixels: number
    },
    table: {
      detected: boolean,
      horizontalLines: number,        // Row count
      verticalLines: number           // Column count
    },
    text: {
      textPresent: boolean,
      textDensity: number,            // 0-1 ratio
      textPixels: number
    }
  },
  enhancedCanvas: HTMLCanvasElement,  // Processed image
  originalCanvas: HTMLCanvasElement,  // Raw capture
  summary: {
    totalIssues: number,
    passedChecks: number              // Out of 5
  }
}
```

## Common Integration Points

### Using scanDocument in a Component
```javascript
import { scanDocument, canvasToFile } from './utils/documentScanner';

// Scan a captured file
try {
  const result = await scanDocument(capturedFile);
  
  if (result.isValid) {
    // Process enhanced image
    const enhancedFile = await canvasToFile(result.enhancedCanvas, 'document.jpg');
    // Upload enhancedFile
  } else {
    // Show errors
    result.issues.forEach(issue => console.log(issue));
  }
} catch (error) {
  console.error('Scanning failed:', error);
}
```

### SmartCamera Integration
```javascript
import SmartCamera from './smartcamera';

<SmartCamera
  open={showCamera}
  onClose={() => setShowCamera(false)}
  onCapture={(processedFile) => {
    // processedFile is already validated and enhanced
    handleUpload(processedFile);
  }}
/>
```

## Threshold Values (Tunable)

Located in `documentScanner.js`:

```javascript
// Blur Detection
BLUR_THRESHOLD = 100              // Laplacian variance threshold

// Lighting Analysis
BRIGHTNESS_MIN = 50               // Too dark threshold
BRIGHTNESS_MAX = 200              // Too bright threshold
SHADOW_DIFFERENCE = 80            // Max quadrant variance
DYNAMIC_RANGE_MIN = 50            // Min contrast threshold

// Document Detection
DOCUMENT_SIZE_MIN = 0.3           // Min 30% of image
MIN_HORIZONTAL_LINES = 3          // Table row count
MIN_VERTICAL_LINES = 2            // Table column count

// Text Detection
TEXT_DENSITY_MIN = 0.05           // Min 5% text density
TEXT_THRESHOLD_DARK = 100         // Pixel < 100 = text
TEXT_THRESHOLD_LIGHT = 200        // Pixel > 200 = text
```

## Customization Guide

### Adjust Blur Sensitivity
```javascript
// In detectBlur function
const BLUR_THRESHOLD = 100;  // Lower = stricter, Higher = lenient
// Typical: 80-150 range
```

### Adjust Lighting Requirements
```javascript
// In analyzeLighting function
if (avgBrightness < 50) { ... }      // Change 50
if (avgBrightness > 200) { ... }     // Change 200
if (dynamicRange < 50) { ... }       // Change 50
if (shadowDifference > 80) { ... }   // Change 80
```

### Adjust Table Detection Sensitivity
```javascript
// In detectTableStructure function
const MIN_HORIZONTAL_LINES = 3;  // Min rows needed
const MIN_VERTICAL_LINES = 2;    // Min cols needed
```

## Testing Scenarios

### Test with Different Documents
```javascript
// Blurry document
testFile = blurryImage.jpg
// Expected: issues includes blur detection

// Dark document  
testFile = darkImage.jpg
// Expected: issues includes lighting

// Partial document
testFile = partialDocument.jpg
// Expected: issues includes edge detection

// No table
testFile = plainPage.jpg
// Expected: issues includes table detection
```

### Debugging Validation
```javascript
const result = await scanDocument(file);

// Check which validation failed
console.log('Blur:', result.validations.blur);
console.log('Lighting:', result.validations.lighting);
console.log('Edges:', result.validations.edges);
console.log('Table:', result.validations.table);
console.log('Text:', result.validations.text);

// See all issues
console.log('Issues:', result.issues);
```

## Performance Optimization Tips

### For Slow Devices
```javascript
// In smartcamera.jsx, reduce video resolution
video: { 
  facingMode: "environment",
  width: { ideal: 640 },   // Reduced from 1280
  height: { ideal: 480 }   // Reduced from 720
}

// In documentScanner.js, reduce canvas size
const maxDim = 800;  // Reduced from 1200
```

### For Faster Processing
```javascript
// Skip certain validations if needed
// (Not recommended - may reduce quality)

// Or use Web Workers for processing
const worker = new Worker('scanner.worker.js');
```

## Error Message Customization

All error messages are in `documentScanner.js`:

```javascript
// Blur Detection
"Image is blurry. Please capture again."

// Lighting
"Image is too dark. Please use flash or improve lighting and capture again."
"Image is overexposed. Avoid glare and capture again."
"Low contrast image. Capture in better lighting."

// Edges
"Document edges not detected. Please capture the full page."

// Table
"No table detected in the image. Please capture an image with a table."

// Text
"Text not detected. Please capture clearly with visible text."
```

Modify these strings to match your app's tone or localize them.

## API Changes History

### V1.0 (Current)
- Initial implementation
- 6-step validation pipeline
- Canvas-based enhancement
- Real-time camera capture

## Dependencies

### Required
- React 16.8+ (hooks)
- lucide-react (icons)
- HTML5 Canvas API
- Web APIs (getUserMedia, FileReader)

### Optional (Future)
- Tesseract.js (OCR)
- OpenCV.js (advanced processing)
- pdf.js (PDF support)

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| getUserMedia | ✅ | ✅ | ✅ | ✅ |
| Canvas API | ✅ | ✅ | ✅ | ✅ |
| Blob API | ✅ | ✅ | ✅ | ✅ |
| HTTPS Required | ✅ | ✅ | ✅ | ✅ |

## Common Issues & Solutions

### Camera Not Available
```javascript
// Check if browser supports
if (!navigator.mediaDevices?.getUserMedia) {
  console.log("Camera not supported");
  // Show gallery upload fallback
}
```

### HTTPS Required
```javascript
// Camera access REQUIRES HTTPS in production
// Only HTTP works on localhost
// Error: NotAllowedError if HTTPS not used
```

### Memory Issues
```javascript
// Reduce image size
const maxDim = 800;  // Default 1200

// Revoke object URLs promptly
URL.revokeObjectURL(objectUrl);
```

## Future Enhancement Hooks

### Add OCR Validation
```javascript
// In documentScanner.js
const validateOCR = async (canvas) => {
  const { data } = await Tesseract.recognize(canvas);
  return data.text.length > 0;
}

// Add to validation pipeline after text detection
```

### Add Perspective Correction
```javascript
// Detect document corners
const corners = detectCorners(grayData);

// Apply perspective transformation
const corrected = perspectiveTransform(canvas, corners);
```

### Add Analytics
```javascript
// Track validation failures
const trackValidation = (file, result) => {
  analytics.log({
    event: 'document_scanned',
    isValid: result.isValid,
    issues: result.issues,
    duration: processingTime
  });
}
```

## Support & Debugging

### Enable Debug Logging
```javascript
// In documentScanner.js
const DEBUG = true;  // Set to true

// Will log detailed info for each validation step
```

### Test Validation Independently
```javascript
import { scanDocument } from './utils/documentScanner';

// Test with different images
const testImages = [
  'blur.jpg',
  'dark.jpg',
  'good.jpg'
];

for (const testImg of testImages) {
  const result = await scanDocument(testImg);
  console.log(`${testImg}:`, result.isValid, result.issues);
}
```

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Status:** Production Ready ✅
